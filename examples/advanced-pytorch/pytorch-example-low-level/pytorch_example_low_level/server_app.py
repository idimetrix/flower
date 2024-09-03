"""pytorch-example-low-level: A low-level Flower / PyTorch app."""

from collections import OrderedDict
from logging import INFO
from typing import List

import numpy as np
import torch.nn as nn
from pytorch_example_low_level.task import Net, apply_eval_transforms, test
from pytorch_example_low_level.utils import (
    parameters_record_to_state_dict,
    state_dict_to_parameters_record,
)
from torch.utils.data import DataLoader

from datasets import load_dataset
from flwr.common import ConfigsRecord, Context, Message, MessageType, RecordSet
from flwr.common.logger import log
from flwr.server import Driver, ServerApp

app = ServerApp()


@app.main()
def main(driver: Driver, context: Context) -> None:

    num_rounds = context.run_config["num-server-rounds"]
    batch_size = context.run_config["batch-size"]
    server_device = context.run_config["server-device"]

    # Initialize global model
    global_model = Net()

    # Prepare global test set and dataloader
    global_test_set = load_dataset("zalando-datasets/fashion_mnist")["test"]

    testloader = DataLoader(
        global_test_set.with_transform(apply_eval_transforms),
        batch_size=batch_size,
    )

    for server_round in range(num_rounds):
        log(INFO, "Starting round %s/%s", server_round + 1, num_rounds)

        # Get IDs of nodes available
        node_ids = driver.get_node_ids()

        # TODO: implement some form of node filtering

        # Create messages
        messages = construct_messages(
            global_model, driver, node_ids, MessageType.TRAIN, server_round
        )

        # Send messages and wait for all results
        replies = driver.send_and_receive(messages)
        log(INFO, "Received %s/%s results", len(replies), len(messages))

        # Aggregate received models
        updated_global_state_dict = aggregate_parameters_from_messages(replies)

        # Update global model
        global_model.load_state_dict(updated_global_state_dict)

        # Centrally evaluate global model
        global_model.to(server_device)
        loss, accuracy = test(global_model, testloader, device=server_device)
        log(
            INFO,
            f"Centrally evaluated model -> loss: {loss: .4f} /  accuracy: {accuracy: .4f}",
        )


def aggregate_parameters_from_messages(messages: List[Message]) -> nn.Module:
    """Aggregate all ParametersRecords sent by `ClientApp`s.

    Return a PyTorch model that will server as new global model.
    """

    state_dict_list = []
    # Get state_dicts from each message
    for msg in messages:
        if msg.has_error():
            continue
        # Extract ParametersRecord with the udpated model sent by the `ClientApp`
        state_dict_as_p_record = msg.content.parameters_records["updated_model_dict"]
        # Convert to PyTorch's state_dict and append
        state_dict_list.append(parameters_record_to_state_dict(state_dict_as_p_record))

    # Initialize from first state_dict to accumulate sums
    new_global_dict = state_dict_list[0]

    # Iterate through each dictionary in the list
    for d in state_dict_list:
        for key, value in d.items():
            new_global_dict[key] = np.add(new_global_dict[key], value)

    # Now take the average
    for key in new_global_dict:
        new_global_dict[key] = new_global_dict[key] / len(state_dict_list)

    # Retun aggregated state_dict
    return OrderedDict(new_global_dict)


def construct_messages(
    global_model: nn.Module,
    driver: Driver,
    node_ids: List[int],
    msg_type: MessageType,
    server_round: int,
) -> Message:
    """Construct messages addressing a particular method of a `ClientApp`.

    This function receives a list of node IDs and a PyTorch model
    whose's state_dict will be sent to the `ClientApp`s. With `msg_type`
    you can specify whether this message will be processed by the `ClientApp`'s
    `train` or `evaluate` method.
    """

    # Constuct parameters record out of model's state_dict
    p_record = state_dict_to_parameters_record(global_model.state_dict())

    # We can use a ConfigsRecord to communicate config settings to the `ClientApp`
    # Implement a basic form of learning rate decay
    lr = 0.1 if server_round < 10 else 0.1 / 2
    c_record = ConfigsRecord({"lr": lr})

    # The payload of the messages is an object of type RecordSet
    # It carries dictionaries of different types of records.
    # Note that you can add as many records as you wish
    # https://flower.ai/docs/framework/ref-api/flwr.common.RecordSet.html
    recordset = RecordSet(
        configs_records={"config": c_record},
        parameters_records={"global_model_record": p_record},
    )

    messages = []
    # One message for each node
    # Here we send the same message to all nodes, this is not a requirement
    for node_id in node_ids:
        message = driver.create_message(
            content=recordset,
            message_type=msg_type,
            dst_node_id=node_id,
            group_id=str(server_round),
        )
        messages.append(message)

    return messages