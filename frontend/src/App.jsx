import { ChatProvider } from "./context/ChatContext.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Chat from "./components/Chat.jsx";

function App() {
    return (
        <ChatProvider>
            <div className="flex h-screen overflow-hidden bg-ink-950 text-chalk">
                <Sidebar />
                <main className="min-w-0 flex-1 p-2 pl-0">
                    <div className="h-full overflow-hidden rounded-[22px] border border-line/80">
                        <Chat />
                    </div>
                </main>
            </div>
        </ChatProvider>
    );
}

export default App;