const { z } = require('zod');

// ---------- Shared ----------
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');
const idParams = z.object({ id: objectId });

// Optional text field: null or "" clears it
const optionalText = (max) =>
  z.union([z.string().trim().max(max, `Must be ${max} characters or less`), z.null()]).optional();

// ---------- Auth ----------
const username = z
  .string({ error: 'Username is required' })
  .trim()
  .min(3, 'Username must be between 3 and 30 characters')
  .max(30, 'Username must be between 3 and 30 characters')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Username may only contain letters, numbers, ".", "_" and "-"');

// OWASP: length over complexity rules; 128 cap keeps hashing cost bounded
const newPassword = z
  .string({ error: 'Password is required' })
  .min(12, 'Password must be between 12 and 128 characters')
  .max(128, 'Password must be between 12 and 128 characters');

// Login accepts any existing password (older accounts may predate the 12-char rule)
const anyPassword = z.string({ error: 'Password is required' }).min(1, 'Password is required').max(128);

const registerBody = z.object({ username, password: newPassword });

// Optional browser GPS. Anything malformed is dropped (never blocks the login);
// range checks happen in utils/geo.js.
const loginGeo = z
  .object({ lat: z.number(), lng: z.number(), accuracy: z.number() })
  .optional()
  .catch(undefined);

const loginBody = z.object({
  username: z.string({ error: 'Username is required' }).trim().min(1, 'Username is required').max(30),
  password: anyPassword,
  geo: loginGeo,
});

const userIdParams = z.object({ userId: objectId });

// ---------- Player profile ----------
const PROFILE_LIMITS = {
  displayName: 50,
  bio: 500,
  country: 60,
  dateOfBirth: 20,
  gender: 20,
  position: 50,
  team: 60,
};

const profileBody = z
  .object(Object.fromEntries(Object.entries(PROFILE_LIMITS).map(([key, max]) => [key, optionalText(max)])))
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: `Nothing to update. Allowed fields: ${Object.keys(PROFILE_LIMITS).join(', ')}`,
  });

// ---------- Todos ----------
const TODO_STATUSES = ['created', 'done', 'deleted'];
const todoStatus = z.enum(TODO_STATUSES, { error: `Invalid status. Must be: ${TODO_STATUSES.join(', ')}` });
const todoTitle = z
  .string({ error: 'Title is required and must be a non-empty string' })
  .trim()
  .min(1, 'Title is required and must be a non-empty string')
  .max(100, 'Title must be 100 characters or less');

const createTodoBody = z.object({
  title: todoTitle,
  description: optionalText(500),
});

const updateTodoBody = z.object({
  title: todoTitle.optional(),
  description: optionalText(500),
  status: todoStatus.optional(),
});

const todoQuery = z.object({ status: todoStatus.optional() });

// ---------- About me ----------
const ABOUT_ME_FIELDS = [
  'name', 'birthday', 'status', 'from', 'title', 'favoriteColor', 'favoriteSong',
  'favoriteMovie', 'favoriteFood', 'myHobbies', 'wordsThatDescribeMe', 'myDreams',
  'thingsILove', 'funFactsAboutMe', 'myMoto',
];

const aboutMeBody = z.object(
  Object.fromEntries(ABOUT_ME_FIELDS.map((key) => [key, optionalText(500)]))
);

// ---------- Admin ----------
const loginEventsQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(5000).default(1000),
  userId: objectId.optional(),
  success: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

// A user's own login history: no userId (always the caller), smaller default page
const myLoginEventsQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  success: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

module.exports = {
  idParams,
  loginEventsQuery,
  myLoginEventsQuery,
  userIdParams,
  registerBody,
  loginBody,
  profileBody,
  PROFILE_FIELDS: Object.keys(PROFILE_LIMITS),
  createTodoBody,
  updateTodoBody,
  todoQuery,
  aboutMeBody,
};
