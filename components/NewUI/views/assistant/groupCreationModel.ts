/**
 * Creating a new group from the new-UI assistant dialogs. React-free so it is unit-testable.
 *
 * Why this exists: POST /groups/create requires `group_name` and `members`, and names its
 * optional lists `types`, `amplify_groups` and `system_users` (amplify-genai-backend
 * object-access/schemata/create_admin_group_schema.py). The dialogs used to send `name`,
 * `groupTypes`, `amplifyGroups` and `systemUsers` with no members. Both required fields were
 * missing, so every request was rejected and the user only saw "Failed to create team".
 */
import { AmplifyUsers, resolveUsernameForEmail } from '@/components/NewUI/shared/emailSuggestions';
import { createAstAdminGroup, groupFromCreateResult } from '@/services/groupsService';
import { CreateAdminGroupRequest, Group, GroupAccessType, Members } from '@/types/groups';
import { AMPLIFY_ASSISTANTS_GROUP_NAME } from '@/utils/app/amplifyAssistants';

export const CREATE_GROUP_FALLBACK_ERROR = 'Failed to create team. Please try again.';
export const CREATE_GROUP_SIGN_IN_ERROR = 'Sign in before creating a group.';

export interface NewGroupRequest {
    name: string;
    /** Username of the signed-in user, who becomes the group's admin. */
    creator: string | null | undefined;
    otherMembers?: Members;
    /** Groups the name must not collide with: the ones the user can already manage. */
    existingGroups: ReadonlyArray<Pick<Group, 'name'>>;
}

export type CreateGroupOutcome =
    | { ok: true; group: Group }
    | { ok: false; message: string };

const normalizeName = (name: unknown): string =>
    typeof name === 'string' ? name.trim().toLowerCase() : '';

/**
 * Request body for a new group. The creator is always an admin, whatever `otherMembers`
 * says about them.
 */
export function buildCreateGroupPayload(
    name: string,
    creator: string,
    otherMembers: Members = {},
): CreateAdminGroupRequest {
    return {
        group_name: name.trim(),
        members: { ...otherMembers, [creator]: GroupAccessType.ADMIN },
        types: [],
        amplify_groups: [],
        system_users: [],
    };
}

/**
 * Why `name` can't be used for a new group, or '' when it can. The rules are the classic
 * create-group dialog's (AssistantAdminUI `groupCreate`), compared without case or outer
 * spaces so "Research Group" and " research group" count as the same name.
 */
export function validateNewGroupName(
    name: string,
    existingGroups: ReadonlyArray<Pick<Group, 'name'>>,
): string {
    const wanted = normalizeName(name);
    if (!wanted) return 'Group name is required.';
    if (wanted === normalizeName(AMPLIFY_ASSISTANTS_GROUP_NAME)) {
        return `The group name ${AMPLIFY_ASSISTANTS_GROUP_NAME} isn't available. Please choose a different group name.`;
    }
    if (existingGroups.some((group) => normalizeName(group?.name) === wanted)) {
        return 'Group name must be unique to all groups you are a member of.';
    }
    return '';
}

/**
 * The members to create a group with besides its creator: each email as the Amplify
 * username it belongs to (the address itself when no user has it), with the access picked
 * for that email, or write access when none was picked.
 */
export function collectOtherMembers(
    emails: ReadonlyArray<string>,
    creator: string | null | undefined,
    amplifyUsers: AmplifyUsers,
    accessByEmail: Readonly<Record<string, GroupAccessType>> = {},
): Members {
    const members: Members = {};
    emails.forEach((email) => {
        const address = typeof email === 'string' ? email.trim() : '';
        if (!address) return;
        const username = resolveUsernameForEmail(address, amplifyUsers);
        if (username !== creator) {
            members[username] = accessByEmail[email] ?? accessByEmail[address] ?? GroupAccessType.WRITE;
        }
    });
    return members;
}

/**
 * Checks the name, then creates the group together with its creator and members in one
 * request, so there is no follow-up call that can fail and leave a group nobody
 * administers. Nothing is sent when the user is signed out or the name can't be used. On
 * failure `message` is the reason: the rule the name broke, or what the request answered
 * when it answered anything.
 */
export async function createGroupWithMembers({
    name,
    creator,
    otherMembers = {},
    existingGroups,
}: NewGroupRequest): Promise<CreateGroupOutcome> {
    if (!creator) return { ok: false, message: CREATE_GROUP_SIGN_IN_ERROR };

    const nameProblem = validateNewGroupName(name, existingGroups);
    if (nameProblem) return { ok: false, message: nameProblem };

    const payload = buildCreateGroupPayload(name, creator, otherMembers);
    const result = await createAstAdminGroup(payload);
    const data = groupFromCreateResult(result);

    if (!data?.id) {
        const reason =
            result?.success === false && typeof result.message === 'string'
                ? result.message.trim()
                : '';
        return { ok: false, message: reason || CREATE_GROUP_FALLBACK_ERROR };
    }

    return {
        ok: true,
        group: {
            ...data,
            id: data.id,
            name: data.name ?? payload.group_name,
            // The backend drops usernames it doesn't recognise, so its list is the saved one.
            members: data.members ?? payload.members,
            assistants: data.assistants ?? [],
            layeredAssistants: data.layeredAssistants ?? [],
            groupTypes: data.groupTypes ?? [],
            amplifyGroups: data.amplifyGroups ?? [],
            systemUsers: data.systemUsers ?? [],
        },
    };
}
