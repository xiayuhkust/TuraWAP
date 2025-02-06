import { Agent, OfficialAgent, Workflow } from "../types/agentTypes";
import { WalletManagerImpl } from "../lib/tura-wallet/wallet_manager";
import { MockWalletAgent } from "../agentic_workflow/MockWalletAgent";
import { MockAgentManager } from "../agentic_workflow/MockAgentManager";
import { TuraWorkflow } from "../agentic_workflow/TuraWorkflow";

// Initialize with mock implementations by default since RPC is unavailable

// Official agents are managed separately from community agents
export const officialAgents: OfficialAgent[] = [
  {
    name: 'WalletAgent',
    contractAddress: '',  // No contract address as it's a built-in agent
    description: 'Your personal wallet assistant for managing TURA transactions',
    feePerRequest: '0.0 TURA',
    owner: '',  // No specific owner as it's a system agent
    chainId: 1337,
    status: 'OFFICIAL',
    instance: new MockWalletAgent()  // Default to mock implementation
  },
  {
    name: 'AgentManager',
    contractAddress: '',  // No contract address as it's a built-in agent
    description: 'Deploy and manage TuraAgent contracts with metadata collection',
    feePerRequest: '0.0 TURA',
    owner: '',  // No specific owner as it's a system agent
    chainId: 1337,
    status: 'OFFICIAL',
    instance: new MockAgentManager()
  }
];

// Event system for store updates
const storeEvents = new EventTarget();

export function subscribeToAgentStore(callback: () => void) {
  const handler = () => callback();
  storeEvents.addEventListener('agentUpdate', handler);
  return () => storeEvents.removeEventListener('agentUpdate', handler);
}

// Initialize agents store (empty by default)
export const agents: Agent[] = [];

// Get references to existing agent instances
const walletAgent = officialAgents.find(a => a.name === 'WalletAgent')?.instance;
const agentManager = officialAgents.find(a => a.name === 'AgentManager')?.instance;

// Initialize TuraWorkflow with the required agent instances
if (!walletAgent || !agentManager || !(walletAgent instanceof MockWalletAgent) || !(agentManager instanceof MockAgentManager)) {
  throw new Error('Required official agents not found or have incorrect type');
}

// Create workflow instances with shared wallet manager
export const createWorkflows = (walletManager: WalletManagerImpl): Workflow[] => [
  {
    name: 'TuraWorkflow',
    contractAddress: '0x' + Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b => b.toString(16).padStart(2, '0')).join(''),
    description: 'Automated workflow for wallet setup and agent registration',
    fee: '0.1 TURA',
    owner: '0x0000000000000000000000000000000000000000',
    requiredConfirmations: 1,
    turaToken: '0x0000000000000000000000000000000000000000',
    usdtToken: '0x0000000000000000000000000000000000000000',
    status: 'VALID',
    instance: new TuraWorkflow(walletManager)
  }
];

export const workflows: Workflow[] = [];

// Helper functions for managing agents and workflows
export const getAgent = (address: string): Agent | OfficialAgent | undefined => {
  // First check official agents
  const officialAgent = officialAgents.find(agent => 
    agent.contractAddress && agent.contractAddress.toLowerCase() === address.toLowerCase()
  );
  if (officialAgent) return officialAgent;
  
  // Then check community agents
  return agents.find(agent => agent.contractAddress.toLowerCase() === address.toLowerCase());
};

export const getWorkflow = (address: string): Workflow | undefined => 
  workflows.find(workflow => workflow.contractAddress.toLowerCase() === address.toLowerCase());

// Helper to get all agents including official ones
export const getAllAgents = (): (Agent | OfficialAgent)[] => {
  return [...officialAgents, ...agents];
};

// Function to validate contract addresses
export const isValidAddress = (address: string): boolean => /^0x[a-fA-F0-9]{40}$/.test(address);

// Function to add a new agent to the store
export const addAgentToStore = (newAgent: Agent): void => {
  if (!isValidAddress(newAgent.contractAddress)) {
    throw new Error('Invalid contract address');
  }
  
  // Check for duplicate contract address
  if (agents.some(agent => agent.contractAddress.toLowerCase() === newAgent.contractAddress.toLowerCase())) {
    throw new Error('Agent with this contract address already exists');
  }
  
  agents.push({
    ...newAgent,
    status: 'VALID',
    chainId: 1337
  });
  storeEvents.dispatchEvent(new Event('agentUpdate'));
};
