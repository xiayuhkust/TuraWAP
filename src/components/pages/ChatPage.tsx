import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Send, Bot, Code2, Wallet } from 'lucide-react';
import { TuraWorkflow } from '../../agentic_workflow/TuraWorkflow';
import { WalletManagerImpl } from '../../lib/tura-wallet/wallet_manager';
import { AgenticWorkflow } from '../../agentic_workflow/AgenticWorkflow';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { WalletDisplay } from '../wallet/WalletDisplay';
import { WalletErrorBoundary } from '../wallet/WalletErrorBoundary';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { officialAgents, agents, createWorkflows } from '../../stores/agent-store';
import { Agent, OfficialAgent, Workflow } from '../../types/agentTypes';
import { MockWalletAgent } from '../../agentic_workflow/MockWalletAgent';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

import { Message } from '../../agentic_workflow/AgenticWorkflow';

interface ChatMessage extends Message {
  id: string;
}

interface SignatureDetails {
  title: string;
  description: string;
  requirePassword?: boolean;
  onConfirm: (password?: string) => Promise<void>;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const updateMessages = useCallback((newMessages: Message[]): void => {
    setMessages((prevMessages: ChatMessage[]) => {
      if (JSON.stringify(prevMessages) === JSON.stringify(newMessages)) return prevMessages;
      return newMessages.map((msg, index) => ({
        id: `${Date.now()}-${index}`,
        text: msg.text,
        timestamp: msg.timestamp,
        sender: msg.sender
      }));
    });
  }, []);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureDetails] = useState<SignatureDetails | null>(null);
  const [password, setPassword] = useState('');
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pressProgress, setPressProgress] = useState(0);
  const pressTimer = useRef<number | null>(null);
  const [workflows] = useState(() => createWorkflows(new WalletManagerImpl()));
  const turaWorkflow = useRef<TuraWorkflow | null>(null);
  
  useEffect(() => {
    if (workflows[0]?.instance instanceof TuraWorkflow) {
      turaWorkflow.current = workflows[0].instance;
    }
  }, [workflows]);
  const [activeAgent, setActiveAgent] = useState<OfficialAgent | Agent | Workflow | null>(officialAgents[0]);
  const [walletAgent] = useState(() => {
    const instance = officialAgents[0].instance;
    if (!(instance instanceof MockWalletAgent)) {
      throw new Error('Expected WalletAgent instance to be MockWalletAgent');
    }
    return instance;
  });
  

  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  // Initialize chat
  useEffect(() => {
    const initializeChat = async () => {
      if (hasInitialized.current) return;
      hasInitialized.current = true;

      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('chat_guest_')) {
          localStorage.removeItem(key);
        }
      });

      // No welcome message needed since we have example buttons
    };

    initializeChat();
  }, [walletAgent, updateMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText) return;
    setInputText('');

    try {
        // Handle "Start Workflow" command
        if (text.toLowerCase() === 'start workflow') {
          if (!turaWorkflow.current) return;
          const result = await turaWorkflow.current.processMessage('start workflow');
          const message: ChatMessage = {
            id: Date.now().toString(),
            text: result,
            timestamp: new Date().toISOString(),
            sender: 'agent'
          };
          setMessages(prev => [...prev, message]);
          return;
        }

        if (!activeAgent || activeAgent.name === 'WalletAgent') {
          if (!(walletAgent instanceof AgenticWorkflow)) {
            return;
          }
          // Local wallet handles messages
          await walletAgent.processMessage(text);
          const newMessages = walletAgent.getMessages();
          updateMessages(newMessages);
        } else {
          const agentInstance = activeAgent?.instance;
          if (!agentInstance || !(agentInstance instanceof AgenticWorkflow)) {
            return;
          }
          
          try {
            await agentInstance.processMessage(text);
            const newMessages = agentInstance.getMessages();
            updateMessages(newMessages);
          } catch (error) {
            console.error('Agent operation failed:', error);
            const errorMessage: Message = {
              text: `Agent operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              sender: 'agent',
              timestamp: new Date().toISOString()
            };
            updateMessages([...messages, errorMessage]);
          }
        }
    } catch (error: unknown) {
      console.error('Agent processing error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorMessage: Message = {
        text: `Error: ${message}`,
        sender: 'agent',
        timestamp: new Date().toISOString()
      };
      updateMessages([...messages, errorMessage]);
    }
  };

  const startRecording = async () => {
    try {
      // Check if mediaDevices API is supported
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('MediaDevices API not supported in this browser');
      }

      // Check if MediaRecorder is supported
      if (!window.MediaRecorder) {
        throw new Error('MediaRecorder not supported in this browser');
      }

      // First check if we have permission
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log('Microphone permission status:', permissionStatus.state);
      
      if (permissionStatus.state === 'denied') {
        throw new Error('Microphone permission denied. Please enable microphone access in your browser settings.');
      }

      // Try to get stream with specific constraints for Baidu API
      let stream;
      try {
        const constraints = {
          audio: {
            sampleRate: 16000,    // Required by Baidu API
            channelCount: 1,      // Mono audio required
            echoCancellation: true,
            noiseSuppression: true
          }
        };
        
        console.log('Requesting audio stream with constraints:', constraints);
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Verify the actual stream settings
        const audioTrack = stream.getAudioTracks()[0];
        const settings = audioTrack.getSettings();
        console.log('Actual audio track settings:', {
          sampleRate: settings.sampleRate,
          channelCount: settings.channelCount,
          deviceId: settings.deviceId,
          groupId: settings.groupId,
          autoGainControl: settings.autoGainControl,
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          timestamp: new Date().toISOString()
        });
        
        // Warn if sample rate doesn't match requirements
        if (settings.sampleRate !== 16000) {
          console.warn('Warning: Audio sample rate does not match required 16kHz:', settings.sampleRate);
        }
      } catch (constraintError) {
        console.warn('Failed to get stream with specific constraints, falling back to default:', constraintError);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Log fallback stream settings
        const audioTrack = stream.getAudioTracks()[0];
        const settings = audioTrack.getSettings();
        console.log('Fallback audio track settings:', settings);
      }

      // Try to use specific MIME type for better compatibility
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';  // Fallback to basic webm
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
        await handleSpeechToText(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      // Start recording with 15-second time limit
      mediaRecorder.start();
      setIsRecording(true);

      // Auto-stop after 15 seconds
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          stopRecording();
        }
      }, 15000);
    } catch (error) {
      // Log detailed error information for debugging
      console.error('Recording failed:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace',
        browserInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          vendor: navigator.vendor,
          mediaDevices: !!navigator.mediaDevices,
          mediaRecorder: !!window.MediaRecorder,
          secure: window.isSecureContext
        },
        constraints: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      // Generate user-friendly error message
      const errMsg = error instanceof Error ? (() => {
        switch (error.name) {
          case 'NotAllowedError':
            return 'Please grant microphone permissions.';
          case 'NotFoundError':
            return 'No microphone found.';
          case 'NotReadableError':
            return 'Microphone is already in use.';
          case 'OverconstrainedError':
            return 'Microphone does not support required audio settings.';
          default:
            return 'Please check your microphone settings.';
        }
      })() : 'Please check your microphone settings.';
      const errorMessage: Message = {
        text: `Failed to start recording: ${errMsg}`,
        sender: 'agent',
        timestamp: new Date().toISOString()
      };
      updateMessages([...messages, errorMessage]);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSpeechToText = async (audioBlob: Blob) => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const response = await fetch('/api/v1/speech-to-text', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Speech-to-text failed: ${response.statusText}`);
      }

      const data = await response.json();
      setInputText(data.text);
    } catch (error) {
      console.error('Speech-to-text error:', error);
      const errorMessage: Message = {
        text: 'Failed to convert speech to text. Please try again.',
        sender: 'agent',
        timestamp: new Date().toISOString()
      };
      updateMessages([...messages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
  <Card className="h-[calc(100vh-8rem)] bg-[#313338]">
    <div className="border-b px-4 py-2 flex items-center">
      <div className="w-[30%] flex flex-col items-center gap-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6" />
            {activeAgent ? activeAgent.name : 'Chat'}
          </CardTitle>
        </CardHeader>
      </div>
      <div className="w-[70%]">
        <WalletErrorBoundary>
          <WalletDisplay />
        </WalletErrorBoundary>
      </div>
    </div>
      {/* Signature Dialog */}
      <Dialog 
        open={showSignatureDialog} 
        onOpenChange={(open: boolean) => {
          if (!open) {
            setPassword('');
          }
          setShowSignatureDialog(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{signatureDetails?.title || 'Confirm Transaction'}</DialogTitle>
            <DialogDescription className="whitespace-pre-wrap">
              {signatureDetails?.description || 'Please confirm this transaction in your wallet.'}
            </DialogDescription>
          </DialogHeader>
          {signatureDetails?.requirePassword && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your wallet password"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <div className="flex justify-between w-full">
              <Button
                variant="outline"
                onClick={() => {
                  setPassword('');
                  setShowSignatureDialog(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (signatureDetails?.onConfirm) {
                    try {
                      if (signatureDetails.requirePassword && !password) {
                        const errorMessage: Message = {
                          text: 'Error: Password is required',
                          sender: 'agent',
                          timestamp: new Date().toISOString()
                        };
                        updateMessages([...messages, errorMessage]);
                        return;
                      }
                      await signatureDetails.onConfirm(signatureDetails.requirePassword ? password : undefined);
                      setPassword('');
                      setShowSignatureDialog(false);
                      
                      // Balance updates are now handled by WalletDisplay component
                    } catch (error) {
                      console.error('Transaction failed:', error);
                      const errorMessage: Message = {
                        text: `Error: ${error instanceof Error ? error.message : 'Transaction failed'}`,
                        sender: 'agent',
                        timestamp: new Date().toISOString()
                      };
                      updateMessages([...messages, errorMessage]);
                    }
                  }
                }}
                disabled={signatureDetails?.requirePassword && !password}
              >
                Sign &amp; Deploy
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      <CardContent className="flex h-full gap-4">
        {/* AgenticWorkflow Sidebar */}
        <div className="w-[30%] border-r pr-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Official Agents
            </h3>

          </div>
          <ScrollArea className="h-[calc(100vh-16rem)]">
            <div className="space-y-6">
              {/* Official Agents */}
              <div className="space-y-2">
                <div className="space-y-2">
                  {officialAgents.map(agent => (
                    <div key={agent.name}>
                      <div
                        className={`p-3 rounded-lg hover:bg-secondary/80 cursor-pointer transition-colors ${
                          activeAgent?.name === agent.name ? 'bg-secondary/90 ring-2 ring-primary' : 'bg-secondary'
                        } ${agent.name === 'WalletAgent' ? 'mt-2' : ''}`}
                        onClick={async () => {
                          const agentInstance = agent?.instance;
                          if (!agentInstance || !(agentInstance instanceof AgenticWorkflow)) {
                            return;
                          }
                          setActiveAgent(agent);
                          const newMessages = agentInstance.getMessages();
                          updateMessages(newMessages);
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium">
                            {agent.name}
                          </div>
                          <Badge variant="secondary" className={`text-xs ${agent.status === 'OFFICIAL' ? 'bg-[#ffd700]' : agent.status === 'VALID' ? 'bg-[#00ff00]' : ''}`}>
                            {agent.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{agent.description}</div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Fee: {agent.feePerRequest}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Community Agents */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Community Agents
                </h3>
                <div className="space-y-2">
                  {agents.map(agent => (
                    <div
                      key={agent.contractAddress}
                      className={`p-3 rounded-lg hover:bg-secondary/80 cursor-pointer transition-colors ${
                        activeAgent?.name === agent.name ? 'bg-secondary/90 ring-2 ring-primary' : 'bg-secondary'
                      }`}
                      onClick={async () => {
                        const agentInstance = agent?.instance;
                        if (!agentInstance || !(agentInstance instanceof AgenticWorkflow)) {
                          return;
                        }
                        setActiveAgent(agent);
                        // Balance updates are now handled by WalletDisplay component
                        const newMessages = agentInstance.getMessages();
                        updateMessages(newMessages);
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium">{agent.name}</div>
                        <Badge variant="secondary" className="text-xs">
                          {agent.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{agent.description}</div>
                      <div className="text-xs font-mono mt-2">
                        Contract: {agent.contractAddress.slice(0, 6)}...{agent.contractAddress.slice(-4)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Fee: {agent.feePerRequest}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Workflows */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Code2 className="h-4 w-4" />
                  Workflows
                </h3>
                <div className="space-y-2">
                  {workflows.map((workflow: Workflow) => (
                    <div
                      key={workflow.contractAddress}
                      className={`p-3 rounded-lg hover:bg-secondary/80 cursor-pointer transition-colors ${
                        activeAgent?.name === workflow.name ? 'bg-secondary/90 ring-2 ring-primary' : 'bg-secondary'
                      }`}
                      onClick={async () => {
                        const workflowInstance = workflow?.instance;
                        if (!workflowInstance || !(workflowInstance instanceof AgenticWorkflow)) {
                          return;
                        }
                        setActiveAgent(workflow);
                        // Balance updates are now handled by WalletDisplay component
                        const newMessages = workflowInstance.getMessages();
                        updateMessages(newMessages);
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium">{workflow.name}</div>
                        <Badge variant="secondary" className="text-xs">
                          {workflow.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{workflow.description}</div>
                      <div className="text-xs font-mono mt-2">
                        Contract: {workflow.contractAddress.slice(0, 6)}...{workflow.contractAddress.slice(-4)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Fee: {workflow.fee} • Confirmations: {workflow.requiredConfirmations}
                      </div>
                      
                    </div>
                  ))}
                </div>
              </div>
              {activeAgent?.name === 'TuraWorkflow' && (
                <div className="relative w-full mt-4">
                  <Button
                    className="w-full"
                    onMouseDown={() => {
                      setPressProgress(0);
                      const startTime = Date.now();
                      const duration = 1000;
                      const updateProgress = () => {
                        const elapsed = Date.now() - startTime;
                        const progress = Math.min(100, (elapsed / duration) * 100);
                        setPressProgress(progress);
                        if (progress < 100) {
                          pressTimer.current = requestAnimationFrame(updateProgress);
                        } else {
                          if (turaWorkflow.current) {
                            turaWorkflow.current.processMessage('start workflow').then((result) => {
                              const message: ChatMessage = {
                                id: Date.now().toString(),
                                text: result,
                                timestamp: new Date().toISOString(),
                                sender: 'agent'
                              };
                              setMessages(prev => [...prev, message]);
                            });
                          }
                        }
                      };
                      pressTimer.current = requestAnimationFrame(updateProgress);
                    }}
                    onMouseUp={() => {
                      if (pressTimer.current) {
                        cancelAnimationFrame(pressTimer.current);
                      }
                      setPressProgress(0);
                    }}
                    onMouseLeave={() => {
                      if (pressTimer.current) {
                        cancelAnimationFrame(pressTimer.current);
                      }
                      setPressProgress(0);
                    }}
                  >
                    Start Workflow
                  </Button>
                  {pressProgress > 0 && (
                    <div 
                      className="absolute bottom-0 left-0 h-1 bg-primary-foreground transition-all"
                      style={{ width: `${pressProgress}%` }}
                    />
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Example Text Buttons */}
          <div className="h-[15%] border-b p-4 flex flex-wrap gap-2">
            {activeAgent?.instance instanceof AgenticWorkflow && 
              (activeAgent.instance as AgenticWorkflow).exampleTxt.map((text, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="bg-[#2b2d31] text-white"
                  onClick={async () => {
                    await handleSendMessage(text);
                  }}
                >
                  {text}
                </Button>
              ))}
          </div>
          {/* Chat Messages Area */}
          <div className="h-[85%] relative flex-1">
            <ScrollArea className="h-[calc(100vh-16rem)] pr-4">
              <div className="space-y-4 pb-16">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.sender === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary'
                      }`}
                    >
                      <div className="break-words whitespace-pre-wrap leading-relaxed">{message.text}</div>
                      <div className="text-xs opacity-70 mt-1">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

          </div>
          
          <div className="flex gap-2 mt-4 relative z-10">
            <Button
              variant="outline"
              size="icon"
              className="bg-[#2b2d31]"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
              className={isRecording ? 'text-destructive' : ''}
            >
              <Mic className="h-4 w-4" />
            </Button>
            <Input
              placeholder="Type your message..."
              value={inputText}
              className="bg-[#383a40] text-white"
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={async (e) => {
                if (e.key === 'Enter' && inputText.trim()) {
                  await handleSendMessage();
                  setInputText('');
                }
              }}
              disabled={isLoading}
            />
            <Button
              variant="outline"
              size="icon"
              className="bg-[#2b2d31]"
              onClick={() => {
                if (walletAgent) {
                  walletAgent.clearMessages();
                }
                updateMessages([]);
              }}
              disabled={isLoading}
            >
              Clear
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
