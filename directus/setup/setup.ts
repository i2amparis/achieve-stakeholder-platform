// Idempotent Directus setup: project settings, the "Public" file folder,
// policies and permissions (from permissions.ts), roles, and API-only service users.
// Usage: npm run setup   (reads .env; needs admin credentials or DIRECTUS_ADMIN_TOKEN)
//
// Service tokens: taken from DIRECTUS_FEEDBACK_TOKEN / DIRECTUS_IMPORT_TOKEN when set
// (production). Locally, missing tokens are generated and appended to .env.

import { randomBytes } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Directus, qs } from './lib/client.ts';
import { POLICIES, RETIRED, ROLES, SERVICE_USERS, PUBLIC_FILES_FOLDER, publicPermissions, type Permission } from './permissions.ts';

const PUBLIC_POLICY_ID = 'abf8a154-5b1c-4a46-ac9c-7300570f4f17'; // built-in public policy
const ENV_FILE = resolve(import.meta.dirname, '../../.env');

const d = await Directus.admin();

// --- settings -------------------------------------------------------------
await d.patch('/settings', {
	project_name: 'ACHIEVE',
	project_descriptor: 'Stakeholder platform',
	project_color: '#283B8D',
	default_language: 'en-GB',
	public_registration: false,
	mcp_enabled: false
});
console.log('settings: updated');

// --- "Public" file folder -------------------------------------------------
let [publicFolder] = await d.get<any[]>('/folders' + qs({ filter: { name: { _eq: 'Public' }, parent: { _null: true } } }));
if (!publicFolder) publicFolder = await d.post('/folders', { name: 'Public' });
console.log('folder Public:', publicFolder.id);

// --- policies and permissions --------------------------------------------
async function replacePermissions(policyId: string, perms: Permission[]) {
	const existing = await d.get<any[]>('/permissions' + qs({ filter: { policy: { _eq: policyId } }, fields: 'id', limit: -1 }));
	if (existing.length) await d.delete('/permissions', existing.map((p) => p.id));
	const resolved = JSON.parse(JSON.stringify(perms).replaceAll(PUBLIC_FILES_FOLDER, publicFolder.id));
	await d.post(
		'/permissions',
		resolved.map((p: Permission) => ({ fields: ['*'], permissions: null, validation: null, presets: null, ...p, policy: policyId }))
	);
	return resolved.length;
}

console.log('policy Public:', await replacePermissions(PUBLIC_POLICY_ID, publicPermissions), 'permissions');

const policyIds: Record<string, string> = {};
for (const spec of POLICIES) {
	const { permissions, ...props } = spec;
	let [policy] = await d.get<any[]>('/policies' + qs({ filter: { name: { _eq: spec.name } } }));
	policy = policy ? await d.patch(`/policies/${policy.id}`, props) : await d.post('/policies', props);
	policyIds[spec.name] = policy.id;
	console.log(`policy ${spec.name}:`, await replacePermissions(policy.id, permissions), 'permissions');
}

// --- roles ------------------------------------------------------------------
const roleIds: Record<string, string> = {};
for (const r of ROLES) {
	let [role] = await d.get<any[]>('/roles' + qs({ filter: { name: { _eq: r.name } } }));
	const props = { name: r.name, icon: r.icon, description: r.description };
	role = role ? await d.patch(`/roles/${role.id}`, props) : await d.post('/roles', props);
	roleIds[r.name] = role.id;
	const access = await d.get<any[]>('/access' + qs({ filter: { role: { _eq: role.id } }, fields: 'id,policy', limit: -1 }));
	const wanted = r.policies.map((p) => policyIds[p]);
	const stale = access.filter((a) => !wanted.includes(a.policy));
	if (stale.length) await d.delete('/access', stale.map((a) => a.id));
	for (const policy of wanted.filter((p) => !access.some((a) => a.policy === p))) {
		await d.post('/access', { role: role.id, policy, sort: 1 });
	}
	console.log(`role ${r.name}: ${r.policies.join(', ')}`);
}

// --- retired roles and policies -------------------------------------------
for (const name of RETIRED.roles) {
	const [role] = await d.get<any[]>('/roles' + qs({ filter: { name: { _eq: name } } }));
	if (!role) continue;
	const users = await d.get<any[]>('/users' + qs({ filter: { role: { _eq: role.id } }, fields: 'id,email' }));
	if (users.length) {
		console.warn(`role ${name}: NOT removed, still assigned to ${users.length} user(s). Reassign them first.`);
		continue;
	}
	await d.delete(`/roles/${role.id}`);
	console.log(`role ${name}: removed (retired)`);
}
for (const name of RETIRED.policies) {
	const [policy] = await d.get<any[]>('/policies' + qs({ filter: { name: { _eq: name } } }));
	if (!policy) continue;
	const access = await d.get<any[]>('/access' + qs({ filter: { policy: { _eq: policy.id } }, fields: 'id' }));
	if (access.length) {
		console.warn(`policy ${name}: NOT removed, still attached to ${access.length} role(s)/user(s).`);
		continue;
	}
	await d.delete(`/policies/${policy.id}`);
	console.log(`policy ${name}: removed (retired)`);
}

// --- service users ------------------------------------------------------
for (const u of SERVICE_USERS) {
	const roleId = roleIds[u.role];
	let [user] = await d.get<any[]>('/users' + qs({ filter: { role: { _eq: roleId }, first_name: { _eq: u.first_name } }, fields: 'id,token' }));
	let token = process.env[u.tokenEnv];
	let generated = false;
	if (!token) {
		token = randomBytes(32).toString('base64url');
		generated = true;
	}
	const props = { first_name: u.first_name, last_name: u.last_name, role: roleId, status: 'active', token };
	user = user ? await d.patch(`/users/${user.id}`, props) : await d.post('/users', props);
	if (generated) {
		appendFileSync(ENV_FILE, `${u.tokenEnv}=${token}\n`);
		process.env[u.tokenEnv] = token;
		console.log(`user ${u.first_name} ${u.last_name}: new token written to .env as ${u.tokenEnv}`);
	} else {
		console.log(`user ${u.first_name} ${u.last_name}: token from ${u.tokenEnv}`);
	}
}

console.log('setup complete');
