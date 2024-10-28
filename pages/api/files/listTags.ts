import createService from "@/pages/api/files/helper";

const listTags = createService("listTags", "/files/tags/list");

export default listTags;