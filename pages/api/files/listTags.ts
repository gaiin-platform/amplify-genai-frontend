import createService from "@/pages/api/files/helper";

const listTags = createService("listTags", "/assistant/tags/list");

export default listTags;