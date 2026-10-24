from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import re


app = FastAPI(title="SkillBridge AI")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    mode: str = "quick"



SYSTEM_PROMPT = """
You are SkillBridge AI - a helpful study mentor for students.

INSTRUCTIONS:
- Answer questions clearly and simply
- Use bullet points for lists
- Keep answers focused and concise
- Be friendly and encouraging
- Provide examples when helpful
- For coding questions, show code with brief explanation

RESPONSE FORMAT:
Start with a direct answer (1-2 sentences).
Then explain using bullet points (3-5 points).
Include a simple example if relevant.

Keep it short and simple - avoid long explanations.
Be a helpful mentor, not a textbook.
"""


def clean_response(text: str) -> str:

    if not text:
        return ""

    # Remove Qwen thinking blocks
    text = re.sub(
        r"<think>.*?</think>",
        "",
        text,
        flags=re.DOTALL | re.IGNORECASE
    )

    # Remove alternative thinking tags
    text = re.sub(
        r"<thinking>.*?</thinking>",
        "",
        text,
        flags=re.DOTALL | re.IGNORECASE
    )

    # Remove Markdown horizontal lines
    text = re.sub(
        r"^\s*[-*_]{3,}\s*$",
        "",
        text,
        flags=re.MULTILINE
    )

    # Remove excessive blank lines
    text = re.sub(
        r"\n{3,}",
        "\n\n",
        text
    )

    return text.strip()



@app.get("/")
def home():
    return {
        "message": "SkillBridge AI is running!"
    }


@app.get("/api/health")
def health():

    return {
        "status": "ok",
        "quick_model": "qwen3:4b-instruct",
        "deep_model": "qwen3:4b-instruct"
    }


from fastapi.responses import StreamingResponse
import json

@app.post("/api/chat")
async def chat(request: ChatRequest):

    message = request.message.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty."
        )

    mode = request.mode.lower()
    if mode not in ["quick", "deep"]:
        mode = "quick"

    
    if mode == "deep":
        model = "qwen3:4b-instruct"
        temperature = 0.6
        top_p = 0.9
        num_predict = 1500  
    else:
        model = "qwen3:4b-instruct"
        temperature = 0.7
        top_p = 0.85
        num_predict = 1200  

    
    payload = {
        "model": model,
        "stream": True,  
        "keep_alive": "10m",
        "options": {
            "temperature": temperature,
            "top_p": top_p,
            "top_k": 30,
            "repeat_penalty": 1.08,
            "num_predict": num_predict  
        },
        "messages": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": message
            }
        ]
    }

    async def generate():
        """Stream response from Ollama - appears instantly but complete"""
        full_answer = ""
        
        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                async with client.stream(
                    "POST",
                    "http://127.0.0.1:11434/api/chat",
                    json=payload
                ) as response:
                    
                    if response.status_code != 200:
                        yield json.dumps({"error": "Ollama error"}) + "\n"
                        return
                    
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        
                        try:
                            chunk = json.loads(line)
                            content = chunk.get("message", {}).get("content", "")
                            
                            if content:
                                full_answer += content
                                
                                yield json.dumps({"text": content}) + "\n"
                        
                        except json.JSONDecodeError:
                            continue
                    
                    
                    final_answer = clean_response(full_answer)
                    
                    if not final_answer:
                        final_answer = (
                            "I couldn't generate an answer right now. "
                            "Please try again."
                        )
                    
                    yield json.dumps({
                        "complete": True,
                        "response": final_answer,
                        "mode": mode,
                        "model": model
                    }) + "\n"
        
        except httpx.ConnectError:
            yield json.dumps({
                "error": "Ollama is not running. Start Ollama first."
            }) + "\n"
        
        except httpx.TimeoutException:
            yield json.dumps({
                "error": "Response took too long. Please try again."
            }) + "\n"
        
        except Exception as e:
            print("SkillBridge Error:", e)
            yield json.dumps({
                "error": "Something went wrong"
            }) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson"
    )