import google.generativeai as genai
from app.core.config import settings

class LLMService:
    def __init__(self):
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model = genai.GenerativeModel('gemini-3.1-flash-lite')
        else:
            self.model = None

    def generate(self, prompt: str) -> str:
        if not self.model:
            return "[Mock LLM - No API KEY] " + prompt[:100] + "..."
        try:
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            return f"Error from LLM: {str(e)}"

llm_service = LLMService()
