import { App } from '../../lib';

import * as path from 'path';
import * as fs from 'fs';
import * as execa from 'execa';

export class VueCli {
	config: any;

	constructor(private app: App) { }

	execVue(command: string, params?: string[]): Promise<any> {
		return new Promise((resolve, reject) => {
			let data = '';
			let stream = null;
			if (fs.existsSync(path.join(this.app.path, "node_modules", ".bin", "vue"))) {
				stream = execa(path.join(this.app.path, "node_modules", ".bin", "vue"), [command, ...params], {
					cwd: this.app.path
				});
				stream.stdout.on('data', d => {
					data += d;
				});
				stream.stderr.on('data', (d) => {
					data += d;
				});

				stream.on('close', (code) => {
					if (code == 0) {
						return resolve(data);
					} else {
						return reject({
							code,
							data
						});
					}
				});
			} else {
				reject(new Error(`vue dependency not found in ${this.app.path}`));
			}
		});
	}

	execVueCliService(cwd: string, command: string, params?: string[]): Promise<any> {
		return new Promise((resolve, reject) => {
			let data = '';
			let stream = null;
			if (fs.existsSync(path.join(cwd, "node_modules", ".bin", "vue-cli-service"))) {
				stream = execa(path.join(cwd, "node_modules", ".bin", "vue-cli-service"), [command, ...params], {
					cwd: cwd
				});
				stream.stdout.on('data', d => {
					data += d;
				});
				stream.stderr.on('data', (d) => {
					data += d;
				});

				stream.on('close', (code) => {
					if (code == 0) {
						return resolve(data);
					} else {
						return reject({
							code,
							data
						});
					}
				});
			} else {
				reject(new Error(`vue-cli-service dependency not found in ${cwd}`));
			}
		});
	}
}