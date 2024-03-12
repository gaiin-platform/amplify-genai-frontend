import createService from "@/pages/api/files/helper";

const deleteTag = createService("deleteTag", "/assistant/tags/delete");

export default deleteTag;