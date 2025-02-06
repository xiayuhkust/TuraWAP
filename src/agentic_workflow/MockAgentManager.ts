import { AgenticWorkflow, Intent } from './AgenticWorkflow';
import { OpenAI } from 'openai';
import { addAgentToStore, getAllAgents } from '../stores/agent-store';
import { getWorkflowRuns } from '../stores/store-econ';
import { AgentData } from '../types/agentTypes';
import { WalletManagerImpl } from '../lib/tura-wallet/wallet_manager';

/// <reference types="vite/client" />

const openai = new OpenAI({
  apiKey: import.meta.env?.VITE_OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true
});

if (!import.meta.env?.VITE_OPENAI_API_KEY) {
  console.error('OpenAI API key not found in environment variables');
}

export class MockAgentManager extends AgenticWorkflow {
  private registrationState: {
    step: 'idle' | 'collecting_name' | 'collecting_description' | 'collecting_company' | 'collecting_socials' | 'confirming_deployment';
    data: Partial<AgentData>;
  };

  private readonly DEPLOYMENT_FEE = 0.1;
  protected walletManager: WalletManagerImpl;

  constructor() {
    super("MockAgentManager", "Deploy and register TuraAgent contracts with metadata collection");
    this.registrationState = { step: 'idle', data: {} };
    this.walletManager = new WalletManagerImpl();
  }

  private generateContractAddress(): string {
    const randomBytes = new Uint8Array(20);
    crypto.getRandomValues(randomBytes);
    return '0x' + Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private async recognizeIntent(text: string): Promise<Intent> {
    try {
      const result = await openai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are an agent registration assistant that classifies user messages into exactly one category. Respond with a JSON object containing 'intent' and 'confidence' fields.

Valid categories:
DEPLOY_CONTRACT - User wants to deploy a new TuraAgent contract (matches: deploy agent, create agent, new agent, register agent)
REGISTER_AGENT - User wants to register agent metadata only (matches: register metadata, update agent info)
LIST_AGENTS - User wants to list registered agents (matches: show agents, list agents, my agents, view agents)
SHOW_EXPENSES - User wants to view their agent usage and expenses (matches: show expenses, view usage, check fees, transaction history)
GENERAL_HELP - Other inquiries or unclear intent

Example: {"intent": "DEPLOY_CONTRACT", "confidence": 0.95}

Note: Be lenient with matching - if the user's intent is clear but phrasing is different, still match with high confidence.`
          },
          { role: 'user', content: text }
        ],
        model: "gpt-3.5-turbo",
        temperature: 0,
        max_tokens: 50,
        response_format: { type: "json_object" }
      });

      const content = result.choices[0].message?.content;
      if (!content) {
        return { name: 'unknown', confidence: 0.0 };
      }
      const completion = JSON.parse(content);
      return {
        name: completion.intent.toLowerCase(),
        confidence: completion.confidence
      };
    } catch (error) {
      console.error('Intent recognition error:', error);
      return { name: 'unknown', confidence: 0.0 };
    }
  }

  protected async handleIntent(_intent: Intent, text: string): Promise<string> {
    try {
      const recognizedIntent = await this.recognizeIntent(text);
      
      if (this.registrationState.step !== 'idle') {
        return await this.handleRegistrationState(text);
      }

      const address = await this.walletManager.getCurrentAddress();
      if (!address && recognizedIntent.name !== 'general_help') {
        return "Please connect your wallet first to interact with agents.";
      }

      if (recognizedIntent.confidence >= 0.7) {
        switch (recognizedIntent.name) {
          case 'deploy_contract':
            return this.startRegistrationFlow();
          
          case 'register_agent':
            return "Agent-only registration without contract deployment is not supported yet. Please use 'Deploy a new agent' to create and register an agent.";
          
          case 'list_agents':
            return await this.listRegisteredAgents();
            
          case 'show_expenses':
            return await this.showExpenses();
        }
      }

      return `I can help you deploy and register TuraAgent contracts. Here's what I can do:

1. Deploy a new TuraAgent contract (costs 0.1 TURA)
   Try: "Deploy a new agent"

2. List your registered agents
   Try: "Show my agents"

3. View your usage and expenses
   Try: "Show expenses"

Note: You must have a connected wallet with sufficient TURA balance (0.1 TURA) to deploy contracts.`;
    } catch (error) {
      console.error('MockAgentManager error:', error);
      return `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`;
    }
  }

  private startRegistrationFlow(): string {
    this.registrationState = {
      step: 'collecting_name',
      data: {}
    };
    return "Let's deploy a new TuraAgent contract. First, what would you like to name your agent?";
  }

  private async handleRegistrationState(text: string): Promise<string> {
    try {
      const { step, data } = this.registrationState;

      switch (step) {
        case 'collecting_name':
          if (!text.trim()) {
            return "Please provide a valid name for your agent.";
          }
          this.registrationState.data = { ...data, name: text };
          this.registrationState.step = 'collecting_description';
          return "Great! Now please provide a description of what your agent does.";

        case 'collecting_description':
          if (!text.trim()) {
            return "Please provide a valid description for your agent.";
          }
          this.registrationState.data = { ...data, description: text };
          this.registrationState.step = 'collecting_company';
          return "Thanks! What company or organization is this agent associated with?";

        case 'collecting_company':
          if (!text.trim()) {
            return "Please provide a valid company or organization name.";
          }
          this.registrationState.data = { ...data, company: text };
          this.registrationState.step = 'collecting_socials';
          return "Almost there! Please provide your GitHub and/or Twitter links (or type 'skip' to skip).";

        case 'collecting_socials': {
          const socialLinks: { github?: string; twitter?: string } = {};
          if (text.toLowerCase() !== 'skip') {
            const githubMatch = text.match(/github\.com\/[\w-]+/);
            const twitterMatch = text.match(/twitter\.com\/[\w-]+/);
            if (githubMatch) socialLinks.github = githubMatch[0];
            if (twitterMatch) socialLinks.twitter = twitterMatch[0];
            if (!githubMatch && !twitterMatch) {
              return "Please provide valid GitHub/Twitter links or type 'skip' to continue without social links.";
            }
          }
          this.registrationState.data = { 
            ...data, 
            socialLinks,
            createdAt: new Date().toISOString()
          };
          this.registrationState.step = 'confirming_deployment';

          // Verify we have all required data
          if (!data?.name || !data?.description || !data?.company) {
            this.registrationState = { step: 'idle', data: {} };
            return "Missing required agent information. Please start the registration process again.";
          }

          return `Great! Here's a summary of your agent:
Name: ${data?.name}
Description: ${data?.description}
Company: ${data?.company}
${Object.entries(socialLinks).map(([k, v]) => `${k}: ${v}`).join('\n')}

Deploying this agent will cost ${this.DEPLOYMENT_FEE} TURA. Type 'confirm' to proceed with deployment or 'cancel' to abort.`;
        }

      case 'confirming_deployment': {
        const lowerText = text.toLowerCase().trim();
        if (lowerText === 'confirm') {
          const address = await this.walletManager.getCurrentAddress();
          if (!address) {
            this.registrationState = { step: 'idle', data: {} };
            return "❌ No wallet found. Please create a wallet first using the WalletAgent.";
          }

          if (!data?.name || !data?.description || !data?.company) {
            this.registrationState = { step: 'idle', data: {} };
            return "❌ Missing required agent information. Please start the registration process again.";
          }

          try {
            const balance = await this.walletManager.getBalance(address);
            if (parseFloat(balance) < this.DEPLOYMENT_FEE) {
              this.registrationState = { step: 'idle', data: {} };
              return `❌ Insufficient balance. You need ${this.DEPLOYMENT_FEE} TURA to deploy an agent contract. Your current balance is ${balance} TURA.

💡 You can get test tokens using the WalletAgent's faucet feature.`;
            }

            const contractAddress = this.generateContractAddress();

            const agentData: AgentData = {
              name: data.name,
              description: data.description,
              company: data.company,
              socialLinks: data.socialLinks || {},
              contractAddress,
              owner: address,
              createdAt: new Date().toISOString()
            };

            // Save agent to store
            addAgentToStore({
              name: agentData.name,
              description: agentData.description,
              contractAddress,
              owner: address,
              company: agentData.company,
              feePerRequest: `${this.DEPLOYMENT_FEE} TURA`,
              multiSigAddress: '',
              status: 'VALID',
              chainId: 1337
            });

            this.registrationState = { step: 'idle', data: {} };
            return `✅ Agent successfully deployed and registered!\n\n` +
              `📋 Contract Details:\n` +
              `Contract Address: ${contractAddress}\n` +
              `Name: ${agentData.name}\n` +
              `Description: ${agentData.description}\n` +
              `Company: ${agentData.company}\n` +
              `Remaining Balance: ${balance} TURA\n\n` +
              `🔍 Next Steps:\n` +
              `1. View your agent details by saying "Show my agents"\n` +
              `2. Deploy another agent by saying "Deploy a new agent"`;
          } catch (error) {
            console.error('Agent deployment error:', error);
            this.registrationState = { step: 'idle', data: {} };
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            return `❌ Failed to deploy agent: ${message}. Please try again or contact support if the issue persists.`;
          }
        } else if (lowerText === 'cancel') {
          this.registrationState = { step: 'idle', data: {} };
          return "Registration cancelled. Let me know if you'd like to try again!";
        } else {
          return "Please type 'confirm' to proceed with deployment or 'cancel' to abort.";
        }
      }
      default:
        return "Something went wrong. Please start over by saying 'Deploy a new agent'.";
    }
  } catch (error) {
    console.error('Registration state error:', error);
    this.registrationState = { step: 'idle', data: {} };
    return `An error occurred during registration: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`;
  }
}

  private async listRegisteredAgents(): Promise<string> {
    const address = await this.walletManager.getCurrentAddress();
    if (!address) {
      return "Please connect your wallet to view your registered agents.";
    }

    const agents = getAllAgents().filter(agent => 
      'owner' in agent && agent.owner?.toLowerCase() === address.toLowerCase()
    );

    if (agents.length === 0) {
      return "You haven't registered any agents yet. Try saying 'Deploy a new agent' to get started.";
    }

    return `Your registered agents:\n${agents.map(agent => 
      `- ${agent.name} (${agent.contractAddress.slice(0,6)}...${agent.contractAddress.slice(-4)})
        Description: ${agent.description}
        Company: ${agent.company}
        Fee: ${agent.feePerRequest || '0 TURA'}`
    ).join('\n\n')}`;
  }

  private async showExpenses(): Promise<string> {
    const address = await this.walletManager.getCurrentAddress();
    if (!address) {
      return "Please connect your wallet to view your expenses.";
    }

    const runs = getWorkflowRuns().filter(run => 
      run.address?.toLowerCase() === address.toLowerCase()
    );

    if (runs.length === 0) {
      return "You haven't made any transactions yet.";
    }

    const agentUsage: { [key: string]: { count: number; totalFee: number } } = {};
    
    runs.forEach(run => {
      run.records.forEach(record => {
        if (!agentUsage[record.agentName]) {
          agentUsage[record.agentName] = { count: 0, totalFee: 0 };
        }
        agentUsage[record.agentName].count++;
        agentUsage[record.agentName].totalFee += record.fee || 0;
      });
    });

    let response = "📊 Your Agent Usage Summary:\n\n";
    Object.entries(agentUsage).forEach(([agentName, stats]) => {
      response += `${agentName}:\n`;
      response += `  Uses: ${stats.count}\n`;
      response += `  Total Fees: ${stats.totalFee} TURA\n\n`;
    });

    const totalFee = Object.values(agentUsage).reduce((sum, stats) => sum + stats.totalFee, 0);
    response += `Total Spent: ${totalFee} TURA`;

    return response;
  }
}
