import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Bot } from 'lucide-react';
import ChatPage from "./components/pages/ChatPage";
import AgentsPage from "./components/pages/AgentsPage";

function App() {
  const [activeTab, setActiveTab] = useState('chat');

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <Tabs defaultValue="chat" className="w-full" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="agents" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Agents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat">
            <ChatPage />
          </TabsContent>

          <TabsContent value="agents">
            <AgentsPage />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;