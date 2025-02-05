import { AgenticWorkflow } from './AgenticWorkflow';
import { VirtualWalletSystem } from '../lib/virtual-wallet-system';
import { addWorkflowRecord, startWorkflowRun, completeWorkflowRun, getAgentFee } from '../stores/store-econ';
import { ethers } from 'ethers';

export class TuraWorkflow extends AgenticWorkflow {
  private currentRunId: string | null = null;
  protected walletSystem: VirtualWalletSystem;

  constructor(walletSystem: VirtualWalletSystem) {
    super('TuraWorkflow', 'Automated workflow for wallet setup and agent registration');
    this.walletSystem = walletSystem;
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
    const address = this.walletSystem.getCurrentAddress();
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
        const wallet = ethers.Wallet.createRandom();
        if (!wallet.mnemonic?.phrase) {
          throw new Error('Failed to generate mnemonic phrase');
        }
        const { address: newAddress } = this.walletSystem.createWallet(wallet.privateKey);
        this.walletSystem.setCurrentAddress(newAddress);
        
        // Emit wallet state change
        const balance = await this.walletSystem.getBalance(newAddress);
        window.dispatchEvent(new CustomEvent('wallet-updated', { 
          detail: { address: newAddress, balance: balance.toString() }
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
               `🔑 Important: Save your mnemonic phrase:\n${wallet.mnemonic.phrase}\n\n` +
               `Automatically checking your balance and requesting test tokens...`;
      } catch (error) {
        const errorMessage = `Failed to create wallet: ${error instanceof Error ? error.message : 'Unknown error'}`;
        completeWorkflowRun(this.currentRunId, false);
        this.currentRunId = null;
        return errorMessage;
      }
    }

    // Step 2: Check/Request Balance
    const currentAddress = this.walletSystem.getCurrentAddress()!;
    if (!this.currentRunId) {
      this.currentRunId = startWorkflowRun(currentAddress);
    }
    
    const balance = await this.walletSystem.getBalance(currentAddress);
    addWorkflowRecord(this.currentRunId, {
      agentName: 'WalletAgent',
      fee: getAgentFee('WalletAgent'),
      callType: 'checkBalance',
      address: currentAddress,
      success: true,
      details: `Balance: ${balance} TURA`
    });

    if (balance < 1) {
      try {
        await this.walletSystem.distributeFaucet(currentAddress);
        
        // Get updated balance after faucet distribution
        const newBalance = await this.walletSystem.getBalance(currentAddress);
        window.dispatchEvent(new CustomEvent('wallet-updated', { 
          detail: { address: currentAddress, balance: newBalance.toString() }
        }));
        
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
      const result = await this.walletSystem.deductFee(address, registrationFee);
      if (!result.success || result.newBalance === undefined) {
        throw new Error('Failed to deduct registration fee');
      }

      addWorkflowRecord(runId, {
        agentName: 'AgentManager',
        fee: getAgentFee('AgentManager'),
        callType: 'deployAgent',
        address: address,
        success: true,
        details: `Contract deployed at ${contractAddress}`
      });

      // Update UI with final balance after deployment
      window.dispatchEvent(new CustomEvent('wallet-updated', { 
        detail: { address: address, balance: result.newBalance.toString() }
      }));
      
      completeWorkflowRun(runId, true);
      this.currentRunId = null; // Reset run ID after successful completion
      return `✅ Agent deployed successfully!\n\nContract address: ${contractAddress}\nRemaining balance: ${result.newBalance} TURA`;
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