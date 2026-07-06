import { z } from 'zod';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
});

const result = schema.safeParse({});
console.log(result.success ? 'Success' : result.error.issues);
