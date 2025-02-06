Here's the component structure of ChatPage.tsx:

Main Layout:
Card (root container)
CardHeader (shows active agent name)
CardContent (main content area)
Sidebar Components (30% width):
ScrollArea
WalletErrorBoundary > WalletDisplay (currently at top)
Official Agents Section
List of OfficialAgents (including WalletAgent)
Community Agents Section
List of community agents
Workflows Section
List of workflows
Chat Area Components:
ScrollArea (chat messages)
Message list
Input Area
Record button
Message input
Send button
Clear button
Dialog Components:
SignatureDialog (for transaction confirmations)
I notice that WalletDisplay is currently placed directly under ScrollArea, but it might be affected by the ScrollArea's styling or behavior. Let me investigate the ScrollArea implementation to understand why WalletDisplay appears under Official Agents.