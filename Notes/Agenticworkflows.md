Let's identify the next three key files for migration:

src/agentic_workflow/MockWalletAgent.ts
Provides the default wallet agent implementation
Handles wallet operations and balance checks
Used by the chat interface for wallet interactions

src/agentic_workflow/MockAgentManager.ts
Manages agent deployment and registration
Handles signature requests through the dialog system
Used for deploying new community agents

src/agentic_workflow/TuraWorkflow.ts
Implements automated workflow functionality
Handles the "Start Workflow" long-press feature
Manages workflow state and execution