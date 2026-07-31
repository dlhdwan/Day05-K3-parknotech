import google.generativeai as genai
from app.core.config import settings


def _infer_provider(model_name: str) -> str | None:
    normalized = model_name.strip().lower()
    if normalized.startswith(("gemini-", "models/gemini-")):
        return "gemini"
    openai_reasoning_prefixes = ("o1", "o3", "o4")
    if normalized.startswith(("gpt-", "chatgpt-")) or normalized.startswith(openai_reasoning_prefixes):
        return "openai"
    return None


class LLMService:
    def __init__(self):
        self.model_name = settings.DEFAULT_LLM_MODEL.strip()
        self.provider = _infer_provider(self.model_name)
        self.model = None
        self.client = None

    def _init_gemini(self) -> None:
        if not settings.GEMINI_API_KEY:
            return

        model_name = self.model_name or settings.GEMINI_MODEL
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel(model_name)

    def _init_openai(self) -> None:
        if not settings.OPENAI_API_KEY:
            return

        from openai import OpenAI

        self.model_name = self.model_name or settings.OPENAI_MODEL
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)

    def _ensure_client(self) -> None:
        if self.provider == "gemini" and self.model is None:
            self._init_gemini()
        elif self.provider == "openai" and self.client is None:
            self._init_openai()

    def generate(self, prompt: str) -> str:
        if not self.provider:
            return f"[Mock LLM - Unsupported model: {self.model_name}] " + prompt[:100] + "..."

        try:
            self._ensure_client()
        except Exception as e:
            return f"Error from LLM: {str(e)}"

        if self.provider == "gemini" and not self.model:
            return "[Mock LLM - Missing GEMINI_API_KEY] " + prompt[:100] + "..."
        if self.provider == "openai" and not self.client:
            return "[Mock LLM - Missing OPENAI_API_KEY] " + prompt[:100] + "..."

        try:
            if self.provider == "gemini":
                response = self.model.generate_content(prompt)
                return response.text

            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            return f"Error from LLM: {str(e)}"


llm_service = LLMService()
