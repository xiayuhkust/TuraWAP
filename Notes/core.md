Core Agent System:
AgenticWorkflow.ts: Base class that defines agent behavior and message handling
MockWalletAgent.ts: Implements wallet operations (create wallet, check balance, faucet)
MockAgentManager.ts: Handles agent deployment and registration
TuraWorkflow.ts: Manages automated workflow execution

State Management:
virtual-wallet-system.ts: Manages wallet state and transactions
store-econ.ts: Tracks workflow runs and transaction history
agent-store.ts: Manages agent registration and metadata

UI Components:
button.tsx & button-variants.ts: Reusable button component with styling
input.tsx: Text input component for messages
utils.ts: Utility functions for styling
The chat interface works like this:

User types/speaks -> Input component captures message
Message sent to AgenticWorkflow -> Intent recognized by agent
Agent processes request -> Updates wallet/workflow state
Response displayed in chat -> UI components render message

Let me explain how the chat interface components work together in more detail:

Chat Message Flow:
ChatPage.tsx: Main container component that:
Renders the chat interface
Manages message history
Handles voice/text input switching
Integrates with AgenticWorkflow for message processing
Agent Interaction System:
AgenticWorkflow.ts provides the base agent functionality:

Message processing pipeline
Intent recognition system
State management
Event dispatching
MockWalletAgent.ts extends this with:

Wallet-specific commands
Balance checking
Token distribution
Transaction handling
State Management:
VirtualWalletSystem.ts handles:
Wallet creation/management
Balance tracking
Transaction processing
Conversation history storage (using localStorage)
UI Components:
sidebar.tsx:
Shows available agents
Displays workflow options
Handles agent selection