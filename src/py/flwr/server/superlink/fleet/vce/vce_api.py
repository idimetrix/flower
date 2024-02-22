# Copyright 2024 Flower Labs GmbH. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ==============================================================================
"""Fleet VirtualClientEngine API."""

import json
from logging import INFO
from typing import Dict

from flwr.client.clientapp import ClientApp, load_client_app
from flwr.client.node_state import NodeState
from flwr.common.logger import log
from flwr.server.superlink.state import StateFactory

NodeToPartitionMapping = Dict[int, int]


def _register_nodes(
    num_nodes: int, state_factory: StateFactory
) -> NodeToPartitionMapping:
    """Register nodes with the StateFactory and create node-id:partition-id mapping."""
    nodes_mapping: NodeToPartitionMapping = {}
    state = state_factory.state()
    for i in range(num_nodes):
        node_id = state.create_node()
        nodes_mapping[node_id] = i
    log(INFO, "Registered %i nodes", len(nodes_mapping))
    return nodes_mapping


# pylint: disable=too-many-arguments,unused-argument
def start_vce(
    num_supernodes: int,
    client_app_str: str,
    backend_str: str,
    backend_config_json_str: str,
    state_factory: StateFactory,
    working_dir: str,
) -> None:
    """Start Fleet API with the VirtualClientEngine (VCE)."""
    # Register SuperNodes
    nodes_mapping = _register_nodes(
        num_nodes=num_supernodes, state_factory=state_factory
    )

    # Construct mapping of NodeStates
    node_states: Dict[int, NodeState] = {}
    for node_id in nodes_mapping:
        node_states[node_id] = NodeState()

    # Load backend config
    _ = json.loads(backend_config_json_str)

    log(INFO, "client_app_str = %s", client_app_str)

    def _load() -> ClientApp:
        app: ClientApp = load_client_app(client_app_str)
        return app

    # start backend
