import { Model, Models } from "@/types/model";

export const filterModels = (modelsMap: Models, hiddenModelIds: string[]): Model[] => {
    const models = Object.values(modelsMap).sort((a,b) => a.name.localeCompare(b.name));
    return models.filter((m:Model) => !hiddenModelIds.includes(m.id));
  };


export const lowestCostModel = (models: Model[]) => {
    if (!models || models.length === 0 ) return null;
    return models.reduce((lowestCostModel, currentModel) => {
      const lowestCost = (lowestCostModel.inputTokenCost || 0) + (lowestCostModel.outputTokenCost || 0);
      const currentCost = (currentModel.inputTokenCost || 0) + (currentModel.outputTokenCost || 0);
  
      return currentCost < lowestCost ? currentModel : lowestCostModel;
    });

}


export const checkAvailableModelId = (astModelId: string | undefined, availableModels: Models) => {
  if (!astModelId) return undefined;
  const validIds = Object.keys(availableModels);
  return validIds.includes(astModelId) ? astModelId : undefined;
}