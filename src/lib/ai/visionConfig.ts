const LS_VISION_MODEL = 'keyvault:vision-model'

/** 需支持 OpenAI 多模态格式的视觉模型，如 Qwen2-VL、GPT-4o 等 */
export const DEFAULT_VISION_MODEL = 'Qwen/Qwen2-VL-7B-Instruct'

export function getVisionModel(): string {
  try {
    return localStorage.getItem(LS_VISION_MODEL) ?? DEFAULT_VISION_MODEL
  } catch {
    return DEFAULT_VISION_MODEL
  }
}

export function setVisionModel(model: string) {
  localStorage.setItem(LS_VISION_MODEL, model.trim() || DEFAULT_VISION_MODEL)
}
