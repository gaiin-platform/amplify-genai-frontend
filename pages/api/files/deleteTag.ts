import createService from "@/pages/api/files/helper";

const deleteTag = createService("deleteTag", "/files/tags/delete");

export default deleteTag;