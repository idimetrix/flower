"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeState = void 0;
const lodash_1 = require("lodash");
const recordset_1 = require("./recordset");
class NodeState {
    nodeId;
    nodeConfig;
    runInfos;
    constructor(nodeId, nodeConfig) {
        this.nodeId = nodeId;
        this.nodeConfig = nodeConfig;
        this.runInfos = {};
    }
    // Register a new run context for this node
    registerContext(runId, run = null, flwrPath = null, appDir = null, fab = null) {
        if (!(runId in this.runInfos)) {
            let initialRunConfig = {};
            if (appDir) {
                const appPath = appDir; // appPath is a string instead of Pathlike in this case
                if ( /* Check if appPath is a directory - this needs specific NodeJS code */true) {
                    const overrideConfig = run?.overrideConfig || {};
                    // initialRunConfig = getFusedConfigFromDir(appPath, overrideConfig);
                }
                else {
                    throw new Error('The specified `appDir` must be a directory.');
                }
            }
            else {
                if (run) {
                    if (fab) {
                        // Load config from FAB and fuse
                        // initialRunConfig = getFusedConfigFromFab(fab.content, run);
                    }
                    else {
                        // Load config from installed FAB and fuse
                        // initialRunConfig = getFusedConfig(run, flwrPath);
                    }
                }
                else {
                    initialRunConfig = {};
                }
            }
            this.runInfos[runId] = {
                initialRunConfig,
                context: {
                    nodeId: this.nodeId,
                    nodeConfig: this.nodeConfig,
                    state: new recordset_1.RecordSet(),
                    runConfig: { ...initialRunConfig },
                },
            };
        }
    }
    // Retrieve the context given a runId
    retrieveContext(runId) {
        if (runId in this.runInfos) {
            return this.runInfos[runId].context;
        }
        throw new Error(`Context for runId=${runId} doesn't exist. A run context must be registered before it can be retrieved or updated by a client.`);
    }
    // Update run context
    updateContext(runId, context) {
        if (!(0, lodash_1.isEqual)(context.runConfig, this.runInfos[runId].initialRunConfig)) {
            throw new Error(`The run_config field of the Context object cannot be modified (runId: ${runId}).`);
        }
        this.runInfos[runId].context = context;
    }
}
exports.NodeState = NodeState;
