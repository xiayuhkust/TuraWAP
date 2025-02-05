import { useState, useEffect } from 'react';
import { Bot, List, Grid } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { workflows, subscribeToAgentStore, getAllAgents } from '../../stores/agent-store';

const truncateText = (text: string | undefined, maxLength: number) => {
  if (!text || text.length <= maxLength) return text || '';
  return text.slice(0, maxLength) + '...';
};

const TRUNCATE_LENGTHS = {
  name: 30,
  description: 100,
  address: 20,
  company: 30,
  fee: 15
};

export default function AgentsPage() {
  const [viewMode, setViewMode] = useState<'list' | 'card'>('card');
  const [, setForceRender] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToAgentStore(() => {
      setForceRender(prev => prev + 1);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Available Agents</CardTitle>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode(mode => mode === 'list' ? 'card' : 'list')}
              className="mr-2"
            >
              {viewMode === 'list' ? <Grid className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </Button>
            <div />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-4">Workflows ({workflows.length})</h2>
              <div className={viewMode === 'list' ? 'space-y-2' : 'space-y-4'}>
                {workflows.map((workflow) => (
                  viewMode === 'list' ? (
                    <div
                      key={workflow.contractAddress}
                      className="flex items-center justify-between p-3 border rounded hover:border-primary transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate">{workflow.name}</h3>
                            <div className="px-2 py-0.5 bg-primary/10 text-primary text-sm rounded-full shrink-0">
                              {workflow.status}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{workflow.description}</p>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-sm">
                            <span className="font-mono">{truncateText(workflow.contractAddress, TRUNCATE_LENGTHS.address)}</span>
                          </div>
                          <div className="text-sm font-semibold text-primary shrink-0">
                            {workflow.fee} TURA
                          </div>
                        </div>
                      </div>
                      
                    </div>
                  ) : (
                    <div
                      key={workflow.contractAddress}
                      className="p-6 border rounded-lg hover:border-primary transition-colors"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-xl font-semibold truncate">{workflow.name}</h3>
                            <div className="px-2 py-1 bg-primary/10 text-primary text-sm rounded-full shrink-0">
                              {workflow.status}
                            </div>
                          </div>
                          <p className="text-muted-foreground mb-4 line-clamp-2">{workflow.description}</p>
                          <div className="space-y-2 font-mono text-sm">
                            <p>Contract: {truncateText(workflow.contractAddress, TRUNCATE_LENGTHS.address)}</p>
                            <p>Owner: {truncateText(workflow.owner, TRUNCATE_LENGTHS.address)}</p>
                            <p>Company: {truncateText(workflow.company, TRUNCATE_LENGTHS.company)}</p>
                            <p>Required Confirmations: {workflow.requiredConfirmations}</p>
                            <p className="text-primary font-semibold">
                              Fee: {workflow.fee} TURA
                            </p>
                          </div>
                          {workflow.name === 'TuraWorkflow' && (
                            <div className="mt-4 flex justify-end">
                              <Button
                                onClick={async () => {
                                  if (!workflow.instance) return;
                                  await workflow.instance.processMessage('start workflow');
                                }}
                              >
                                Start Workflow
                              </Button>
                            </div>
                          )}
                        </div>
                        
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Available Agents ({getAllAgents().length})</h2>
              <div className={viewMode === 'list' ? 'space-y-2' : 'space-y-4'}>
                {getAllAgents().map((agent) => (
                  viewMode === 'list' ? (
                    <div
                      key={agent.contractAddress}
                      className="flex items-center justify-between p-3 border rounded hover:border-primary transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4" />
                            <h3 className="font-semibold truncate">{agent.name}</h3>
                            <div className="px-2 py-0.5 bg-primary/10 text-primary text-sm rounded-full shrink-0">
                              {agent.status}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{agent.description}</p>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-sm">
                            <span className="font-mono">{truncateText(agent.contractAddress, TRUNCATE_LENGTHS.address)}</span>
                          </div>
                          <div className="text-sm font-semibold text-primary shrink-0">
                            {agent.feePerRequest} TURA
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={agent.contractAddress}
                      className="p-6 border rounded-lg hover:border-primary transition-colors"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Bot className="h-4 w-4" />
                            <h3 className="text-xl font-semibold truncate">{agent.name}</h3>
                            <div className="px-2 py-1 bg-primary/10 text-primary text-sm rounded-full shrink-0">
                              {agent.status}
                            </div>
                          </div>
                          <p className="text-muted-foreground mb-4 line-clamp-2">{agent.description}</p>
                          <div className="space-y-2 font-mono text-sm">
                            <p>Contract: {truncateText(agent.contractAddress, TRUNCATE_LENGTHS.address)}</p>
                            <p>Owner: {truncateText(agent.owner, TRUNCATE_LENGTHS.address)}</p>
                            <p>Company: {truncateText(agent.company, TRUNCATE_LENGTHS.company)}</p>
                            {'multiSigAddress' in agent && agent.multiSigAddress && (
                              <p>MultiSig: {truncateText(agent.multiSigAddress, TRUNCATE_LENGTHS.address)}</p>
                            )}
                            <p className="text-primary font-semibold">
                              Fee: {agent.feePerRequest} TURA
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}