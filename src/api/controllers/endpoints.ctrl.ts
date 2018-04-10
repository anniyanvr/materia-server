import { App } from '../../lib';
import { IEndpoint, IParam } from '@materia/interfaces';

import * as path from 'path';
import * as fs from 'fs';

import { EndpointsLib } from '../lib/endpoints';

export class EndpointsController {
	constructor(private app: App) {}

	loadController(req, res) {
		let controllerName = req.params.controllerName;
		try {
			let endpointPath = path.join(this.app.path, 'server', 'controllers');
			const fromAddon = controllerName.split('@materia').length > 1;
			if (fromAddon) {
				const stringArray = controllerName.split('/');
				let addonName = '';

				stringArray.forEach((value, i) => {
					if (i == 0) {
						addonName += value;
					} else {
						addonName += '/' + value;
					}
				});

				controllerName = stringArray[stringArray.length - 1];
				endpointPath = path.join(
					this.app.path,
					'node_modules',
					addonName,
					'server',
					'controllers'
				);
			}
			const code = fs
				.readFileSync(
					path.join(endpointPath, controllerName + '.ctrl.js'),
					'utf-8'
				)
				.toString();
			res.send(code);
		} catch (err) {
			const error = JSON.parse(err);
			res.status(500).json(error);
		}
	}

	createCode(req, res) {
		const controller = req.body.fromAddon
			? req.body.controller
					.split('/')
					[req.body.controller.split('/').length - 1].replace(
						/(\.ctrl)?\.js$/,
						''
					)
			: req.body.controller.replace(/(\.ctrl)?\.js$/, '');
		const basePath = req.body.fromAddon
			? req.body.fromAddon.path
			: this.app.path;
		const fullpath = path.join(
			basePath,
			'server',
			'controllers',
			controller + '.ctrl.js'
		);
		this.app
			.saveFile(fullpath, req.body.code, { mkdir: true })
			.then(() => {
				this.app.api.add({
					method: req.body.method,
					url: req.body.url,
					controller: controller,
					action: req.body.action,
					params: req.body.params,
					permissions: req.body.permissions
				});
				res.status(201).json({
					endpoints: EndpointsLib.list(this.app),
					newSelectedId: req.body.method + req.body.url,
					controllers: this.app.api.getControllers()
				});
			})
			.catch(err => {
				res.status(500).json(err);
			});
	}

	createQuery(req, res) {
		this.app.api.add({
			method: req.body.method,
			url: req.body.url,
			params: req.body.params,
			permissions: req.body.permissions,
			query: req.body.query
		});
		res.status(201).json({
			endpoints: EndpointsLib.list(this.app),
			newSelectedId: req.body.method + req.body.url,
			controllers: this.app.api.getControllers()
		});
	}

	updateCode(req, res) {
		const {method, endpoint} = req.params;
		const newEndpoint = req.body;

		return new Promise((resolve, reject) => {
			const controller = newEndpoint.controller.replace(
				/(\.ctrl)?\.js$/,
				''
			);
			const basePath = this.app.path;
			const fullpath = path.join(
				basePath,
				'server',
				'controllers',
				controller + '.ctrl.js'
			);
			this.app
				.saveFile(fullpath, newEndpoint.code)
				.then(() => {
					let params;
					if (newEndpoint.params) {
						params = EndpointsLib.cleanParams(newEndpoint.params);
					}
					this.app.api.remove(method, endpoint);
					this.app.api.add({
						method: newEndpoint.method,
						url: newEndpoint.url,
						controller: controller,
						action: newEndpoint.action,
						params: params ? params : [],
						permissions: newEndpoint.permissions
					});

					EndpointsLib
						.list(this.app)
						.find(
							endpoint =>
								endpoint.method + endpoint.url ==
								newEndpoint.method +
									newEndpoint.url
						);
					res.status(200).json({
						endpoints: EndpointsLib.list(this.app),
						newSelectedId:
							newEndpoint.method +
							newEndpoint.url,
						controllers: this.app.api.getControllers()
					});
				})
				.catch(err => {
					res.status(500).json(err.message);
				});
		});

	}

	updateQuery(req, res) {
		const {method, endpoint} = req.params;
		const newEndpoint = req.body;
		this.app.api.remove(method, endpoint);
		if (
			newEndpoint.params &&
			newEndpoint.params.length
		) {
			newEndpoint.params = EndpointsLib.cleanParams(
				newEndpoint.params
			);
		}
		if (!newEndpoint.permissions) {
			newEndpoint.permissions = [];
		}
		this.app.api.add({
			method: newEndpoint.method,
			url: newEndpoint.url,
			params: newEndpoint.params
				? newEndpoint.params
				: [],
			permissions: newEndpoint.permissions,
			query: newEndpoint.query
		});

		res.status(200).json({
			endpoints: EndpointsLib.list(this.app),
			newSelectedId:
				newEndpoint.method + newEndpoint.url,
			controllers: this.app.api.getControllers()
		});
	}

	remove(req, res) {
		this.app.api.remove(req.params.method, req.params.endpoint);
		return EndpointsLib.list(this.app);
	}

	generate(req, res) {
		const entity = req.body;
		if (!entity.endpointsGenerated) {
			return null;
		}
		EndpointsLib.generate(this.app, entity, 'get', 'list');
		EndpointsLib.generate(this.app, entity, 'get', 'get');
		EndpointsLib.generate(this.app, entity, 'post', 'create');
		EndpointsLib.generate(this.app, entity, 'put', 'update');
		EndpointsLib.generate(this.app, entity, 'delete', 'delete');

		return EndpointsLib.list(this.app);
	}
}