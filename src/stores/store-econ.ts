export interface WorkflowRecord {
    timestamp: string;
    agentName: string;
    fee: number;
    callType: string;
    address: string;
    success: boolean;
    details?: string;
  }
  
  export interface WorkflowRun {
    id: string;
    startTime: string;
    endTime?: string;
    address: string;
    totalFee: number;
    records: WorkflowRecord[];
    status: 'running' | 'completed' | 'failed';
  }
  
  const WORKFLOW_RECORDS_KEY = 'workflow_records';
  const WORKFLOW_RUNS_KEY = 'workflow_runs';
  
  export function getWorkflowRecords(): WorkflowRecord[] {
    const raw = localStorage.getItem(WORKFLOW_RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  
  export function getWorkflowRuns(): WorkflowRun[] {
    const raw = localStorage.getItem(WORKFLOW_RUNS_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  
  export function startWorkflowRun(address: string): string {
    const runs = getWorkflowRuns();
    const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    const newRun: WorkflowRun = {
      id,
      startTime: new Date().toISOString(),
      address,
      totalFee: 0,
      records: [],
      status: 'running'
    };
    runs.push(newRun);
    localStorage.setItem(WORKFLOW_RUNS_KEY, JSON.stringify(runs));
    return id;
  }
  
  export function addWorkflowRecord(runId: string, record: Omit<WorkflowRecord, 'timestamp'>): void {
    const runs = getWorkflowRuns();
    const runIndex = runs.findIndex(r => r.id === runId);
    if (runIndex === -1) return;
  
    const timestamp = new Date().toISOString();
    const fullRecord: WorkflowRecord = { ...record, timestamp };
    
    runs[runIndex].records.push(fullRecord);
    runs[runIndex].totalFee += record.fee;
    
    localStorage.setItem(WORKFLOW_RUNS_KEY, JSON.stringify(runs));
    
    const records = getWorkflowRecords();
    records.push(fullRecord);
    localStorage.setItem(WORKFLOW_RECORDS_KEY, JSON.stringify(records));
  }
  
  export function completeWorkflowRun(runId: string, success: boolean): void {
    const runs = getWorkflowRuns();
    const runIndex = runs.findIndex(r => r.id === runId);
    if (runIndex === -1) return;
  
    runs[runIndex].endTime = new Date().toISOString();
    runs[runIndex].status = success ? 'completed' : 'failed';
    
    localStorage.setItem(WORKFLOW_RUNS_KEY, JSON.stringify(runs));
  }
  
  export function getAgentFee(agentName: string): number {
    const feeMap: Record<string, number> = {
      'WalletAgent': 0,
      'AgentManager': 0,
      'MarketDataAgent': 1.0,
      'StrategyAgent': 0.01,
      'MultiSigWallet': 0
    };
    return feeMap[agentName] || 0;
  }
  
  export function getWorkflowRunById(runId: string): WorkflowRun | undefined {
    const runs = getWorkflowRuns();
    return runs.find(r => r.id === runId);
  }
  
  export function clearWorkflowData(): void {
    localStorage.removeItem(WORKFLOW_RECORDS_KEY);
    localStorage.removeItem(WORKFLOW_RUNS_KEY);
  }