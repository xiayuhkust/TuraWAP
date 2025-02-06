import { ethers } from 'ethers';

async function testRPCConnection() {
    const rpcUrl = 'https://43.135.26.222:8000';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    try {
        console.log('Testing connection to RPC endpoint:', rpcUrl);
        
        // Try to get the network to test basic connectivity
        const network = await provider.getNetwork();
        console.log('Successfully connected! Network:', network);
        
        // Try to get the latest block number as an additional check
        const blockNumber = await provider.getBlockNumber();
        console.log('Current block number:', blockNumber);
        
    } catch (error) {
        console.error('Connection test failed:', error);
    }
}

testRPCConnection().catch(console.error);
