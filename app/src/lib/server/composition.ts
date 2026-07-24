// Composição server-only — única conexão SQLite por processo, criada de
// forma lazy no primeiro uso e reutilizada nas requisições seguintes. Nunca
// exposta a código client-side (fica sob $lib/server, fronteira imposta
// pelo próprio SvelteKit).

import fs from 'node:fs';
import path from 'node:path';
import { env } from '$env/dynamic/private';
import { catalog } from '$lib/catalog';
import { CryptoIdGenerator, SystemClock, createProjectUseCases, type ProjectUseCases } from './application';
import { createSqliteProjectRepository } from './persistence';

const DEFAULT_DATABASE_PATH = 'local-data/hydra-dev.sqlite';

let useCases: ProjectUseCases | undefined;

export function getProjectUseCases(): ProjectUseCases {
	if (!useCases) {
		const databasePath = env.DATABASE_PATH || DEFAULT_DATABASE_PATH;
		const directory = path.dirname(databasePath);
		if (directory && directory !== '.') {
			fs.mkdirSync(directory, { recursive: true });
		}

		const repository = createSqliteProjectRepository(databasePath);
		useCases = createProjectUseCases({
			repository,
			catalog,
			clock: SystemClock,
			idGenerator: CryptoIdGenerator
		});
	}
	return useCases;
}
