import { Model, Models } from "@/types/model";
import cloneDeep from 'lodash/cloneDeep';

// export const MINIMAL_AVAILABLE_MODELS:Model[] = [Models[ModelID.GPT_4o_MINI],  Models[ModelID.GPT_4o_AZ],  Models[ModelID.CLAUDE_3_HAIKU], Models[ModelID.CLAUDE_3_5_SONNET] ];

export const filterModels = (modelsMap: Models, hiddenModelIds: string[]): Model[] => {
    const models = Object.values(modelsMap).sort((a,b) => a.name.localeCompare(b.name));
    return models.filter((m:Model) => !hiddenModelIds.includes(m.id));
  };