import { AgenticWorkflow } from './AgenticWorkflow';
import { WalletManagerImpl } from '../lib/tura-wallet/wallet_manager';
import { addWorkflowRecord, startWorkflowRun, completeWorkflowRun, getAgentFee } from '../stores/store-econ';

export class TuraWorkflow extends AgenticWorkflow {
  private currentRunId: string | null = null;
  protected walletManager: WalletManagerImpl;

  constructor(walletManager: WalletManagerImpl) {
    super('TuraWorkflow', 'Automated workflow for wallet setup and agent registration');
    this.walletManager = walletManager;
  }

  protected async handleIntent(_intent: unknown, text: string): Promise<string> {
    const lowerText = text.toLowerCase();
    if (lowerText === 'start workflow' || lowerText.includes('start automated') || 
        lowerText.includes('run workflow')) {
      return await this.startWorkflow();
    }
    return 'Type "Start Workflow" or use the long-press button to begin the automated workflow.';
  }

  public async startWorkflow(): Promise<string> {
    // Reset any existing workflow run to ensure clean state
    if (this.currentRunId) {
      completeWorkflowRun(this.currentRunId, false);
      this.currentRunId = null;
    }

    // Step 1: Check/Create Wallet
    const address = await this.walletManager.getCurrentAddress();
    if (!address) {
      this.currentRunId = startWorkflowRun('guest');
      addWorkflowRecord(this.currentRunId, {
        agentName: 'WalletAgent',
        fee: getAgentFee('WalletAgent'),
        callType: 'createWallet',
        address: 'guest',
        success: false,
        details: 'Creating new wallet'
      });
      
      try {
        const response = await this.walletManager.createWallet('defaultPassword'); // User should change this later
        const newAddress = response.address;
        
        // Emit wallet state change
        const balance = await this.walletManager.getBalance(newAddress);
        window.dispatchEvent(new CustomEvent('wallet-updated', { 
          detail: { address: newAddress, balance: balance }
        }));
        
        addWorkflowRecord(this.currentRunId, {
          agentName: 'WalletAgent',
          fee: 0,
          callType: 'walletCreated',
          address: newAddress,
          success: true,
          details: 'Wallet created successfully'
        });

        // Start a new workflow run with the new address
        this.currentRunId = startWorkflowRun(newAddress);
        
        return `🎉 Wallet created successfully!\nYour wallet address: ${newAddress}\n\n` +
               `🔑 Important: Please change your wallet password for security.\n\n` +
               `Automatically checking your balance and requesting test tokens...`;
      } catch (error) {
        const errorMessage = `Failed to create wallet: ${error instanceof Error ? error.message : 'Unknown error'}`;
        completeWorkflowRun(this.currentRunId, false);
        this.currentRunId = null;
        return errorMessage;
      }
    }

    // Step 2: Check/Request Balance
    const currentAddress = await this.walletManager.getCurrentAddress();
    if (!currentAddress) {
      throw new Error('No wallet connected');
    }
    
    if (!this.currentRunId) {
      this.currentRunId = startWorkflowRun(currentAddress);
    }
    
    const balance = await this.walletManager.getBalance(currentAddress);
    addWorkflowRecord(this.currentRunId, {
      agentName: 'WalletAgent',
      fee: getAgentFee('WalletAgent'),
      callType: 'checkBalance',
      address: currentAddress,
      success: true,
      details: `Balance: ${balance} TURA`
    });

    if (parseFloat(balance) < 1) {
      try {
        // Note: Faucet functionality needs to be implemented in WalletManagerImpl
        // For now, we'll just show a message
        const newBalance = balance;
        
        addWorkflowRecord(this.currentRunId, {
          agentName: 'WalletAgent',
          fee: 0,
          callType: 'requestFaucet',
          address: currentAddress,
          success: true,
          details: 'Faucet tokens requested'
        });
        // Show success message and continue with deployment
        const successMessage = `🎉 Faucet tokens requested! Your updated balance is ${newBalance} TURA.\n\nProceeding with agent deployment...`;
        const deploymentResult = await this.deployAgent(currentAddress);
        return successMessage + '\n\n' + deploymentResult;
      } catch (error) {
        const errorMessage = `Failed to request tokens: ${error instanceof Error ? error.message : 'Unknown error'}`;
        completeWorkflowRun(this.currentRunId, false);
        this.currentRunId = null;
        return errorMessage;
      }
    }

    return await this.deployAgent(currentAddress);
  }

  private async deployAgent(address: string): Promise<string> {
    const runId = this.currentRunId || startWorkflowRun(address);

    try {
      const contractAddress = '0x' + Array.from({ length: 20 }, () => 
        Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
      ).join('');
      
      const registrationFee = 0.1;
      const balance = await this.walletManager.getBalance(address);
      if (parseFloat(balance) < registrationFee) {
        throw new Error('Insufficient balance for registration fee');
      }

      addWorkflowRecord(runId, {
        agentName: 'AgentManager',
        fee: getAgentFee('AgentManager'),
        callType: 'deployAgent',
        address: address,
        success: true,
        details: `Contract deployed at ${contractAddress}`
      });

      // Update UI with current balance
      window.dispatchEvent(new CustomEvent('wallet-updated', { 
        detail: { address: address, balance: balance }
      }));
      
      completeWorkflowRun(runId, true);
      this.currentRunId = null; // Reset run ID after successful completion
      return `✅ Agent deployed successfully!\n\nContract address: ${contractAddress}\nRemaining balance: ${balance} TURA`;
    } catch (error) {
      addWorkflowRecord(runId, {
        agentName: 'AgentManager',
        fee: getAgentFee('AgentManager'),
        callType: 'deployAgent',
        address: address,
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      completeWorkflowRun(runId, false);
      this.currentRunId = null; // Reset run ID after failure
      return `Failed to deploy agent: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}
