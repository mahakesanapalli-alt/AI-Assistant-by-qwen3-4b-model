import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./AIAssistant.css";

const API_URL = "http://127.0.0.1:8000";

const QUICK_ACTIONS = [   
  {
    id: "analyze",
    icon: "⌕",
    title: "Analyze Project",
    description: "Understand my project and find areas to improve.",
    prompt:
      "Analyze my project and explain its main components, technologies, strengths, possible problems, and areas that need improvement.",
  },
  {
    id: "roadmap",
    icon: "◈",
    title: "Build Roadmap",
    description: "Create a clear development plan step by step.",
    prompt:
      "Create a practical step-by-step development roadmap for my project. Break it into phases and tasks and explain what I should build first.",
  },
  {
    id: "guidance",
    icon: "➜",
    title: "Get Guidance",
    description: "Get help with the next thing I should build.",
    prompt:
      "Guide me step by step with my project. Tell me what I should work on next and explain the steps clearly for a student.",
  },
];

function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
  messagesEndRef.current?.scrollIntoView({
    behavior: "smooth",
  });
}, [messages, loading]);

  const sendMessage = async (text, mode = "quick") => {
    const userMessage = text.trim();

    if (!userMessage || loading) {
      return;
    }

    // ✅ Add user message
    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        content: userMessage,
      },
    ]);

    setMessage("");
    setLoading(true);

    try {
      // ✅ Create empty AI message that will be filled
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: "",
        },
      ]);

      const response = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          mode: mode,
        }),
      });

      if (!response.ok) {
        throw new Error("API error");
      }

      // ✅ READ STREAMING RESPONSE
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value);
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);

            // ✅ Add text chunks to message as they arrive
            if (data.text) {
              fullResponse += data.text;
              
              setMessages((previous) => {
                const updated = [...previous];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: fullResponse,
                };
                return updated;
              });
            }

            if (data.complete) {
              console.log("✅ Response complete");
            }
          } catch (e) {
            // Ignore JSON errors
          }
        }
      }
    } catch (error) {
      console.error("AI Assistant error:", error);

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "❌ Connection error. Make sure FastAPI and Ollama are running.",
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    sendMessage(message);
  };

  const handleQuickAction = (action) => {
    sendMessage(action.prompt, action.mode || "quick");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Assistant Button */}
      {!isOpen && (
        <button
          className="ai-floating-button"
          onClick={() => setIsOpen(true)}
          aria-label="Open SkillBridge AI Assistant"
        >
          <span className="floating-sparkle">✦</span>
          <span className="floating-icon">AI</span>
        </button>
      )}

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="ai-overlay"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Assistant Panel */}
      <aside className={`ai-panel ${isOpen ? "ai-panel-open" : ""}`}>
        {/* Header */}
        <header className="ai-header">
          <div className="ai-brand">
            <div className="ai-logo">
              <span>✦</span>
            </div>

            <div className="ai-brand-text">
              <h2>SkillBridge AI</h2>
              <div className="ai-status">
                <span className="status-dot"></span>
                <span>AI Assistant</span>
              </div>
            </div>
          </div>

          <button
            className="ai-close-button"
            onClick={() => setIsOpen(false)}
            aria-label="Close AI Assistant"
          >
            ×
          </button>
        </header>

        {/* Chat content */}
        <div className="ai-content">
          {messages.length === 0 ? (
            /* Welcome screen */
            <div className="ai-welcome">
              <div className="welcome-icon">
                <span>✦</span>
              </div>

              <h1>
                Hi! I'm your
                <br />
                project assistant 👋
              </h1>

              <p>
                I can help you understand, plan and build
                your project step by step.
              </p>

              <div className="quick-actions">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    className="quick-action"
                    onClick={() =>
                      handleQuickAction(action)
                    }
                    disabled={loading}
                  >
                    <div className="quick-action-icon">
                      {action.icon}
                    </div>

                    <div className="quick-action-content">
                      <strong>{action.title}</strong>
                      <span>{action.description}</span>
                    </div>

                    <div className="quick-action-arrow">
                      →
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Conversation */
            <div className="ai-conversation">
              {messages.map((item, index) => (
                <div
                  key={index}
                  className={`chat-message ${
                    item.role === "user"
                      ? "chat-message-user"
                      : "chat-message-ai"
                  }`}
                >
                  {item.role === "assistant" && (
                    <div className="message-avatar">✦</div>
                  )}

                  <div
  className={`message-bubble ${
    item.error ? "message-error" : ""
  }`}
>
  {item.role === "assistant" ? (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {item.content}
    </ReactMarkdown>
  ) : (
    item.content
  )}
</div>
                </div>
              ))}

              {loading && (
                <div className="chat-message chat-message-ai">
                  <div className="message-avatar">✦</div>

                  <div className="message-bubble typing-bubble">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div ref={messagesEndRef} />

        {/* Input */}
        <div className="ai-input-section">
          <div className="ai-input-box">
            <input
              type="text"
              value={message}
              placeholder="Ask about your project..."
              onChange={(event) =>
                setMessage(event.target.value)
              }
              onKeyDown={handleKeyDown}
              disabled={loading}
            />

            <button
              className="ai-send-button"
              onClick={handleSend}
              disabled={loading || !message.trim()}
              aria-label="Send message"
            >
              ↑
            </button>
          </div>

          <p className="ai-footer">
            Powered by SkillBridge AI
          </p>
        </div>
      </aside>
    </>
  );
}

export default AIAssistant;