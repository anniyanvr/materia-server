import { readFileSync } from 'fs-extra';
import { join } from 'path';
import { IMigration, IHistoryActions, IActionData } from '@materia/interfaces';

import { App } from './app';

/**
 * Default action types
 * @readonly
 * @enum {string}
 */
export const MigrationType = {
	// entities
	CREATE_ENTITY: 'create_entity',
	RENAME_ENTITY: 'rename_entity',
	DELETE_ENTITY: 'delete_entity',
	ADD_FIELD: 'create_field',
	CHANGE_FIELD: 'change_field',
	DELETE_FIELD: 'delete_field',
	ADD_RELATION: 'add_relation',
	DELETE_RELATION: 'delete_relation',

	// queries
	ADD_QUERY: 'add_query',
	DELETE_QUERY: 'delete_query',
	UPDATE_QUERY: 'update_query',
	// ADD_QUERY_PARAM: 'add_query_param',
	// DELETE_QUERY_PARAM: 'delete_query_param',
	// UPDATE_QUERY_VALUE: 'update_query_value',

	// api
	ADD_ENDPOINT: 'add_endpoint',
	DELETE_ENDPOINT: 'delete_endpoint',
	UPDATE_ENDPOINT: 'update_endpoint'
	// ADD_API_PARAM: 'add_api_param',
	// DELETE_API_PARAM: 'delete_api_param',
	// ADD_API_DATA: 'add_api_data',
	// DELETE_API_DATA: 'delete_api_data',
};

/**
 * @class History
 * @classdesc
 * Used to store the last actions and undo / redo these actions.
 */
export class History {
	action: any;
	diff: Array<IMigration>;
	diffRedo: Array<IMigration>;
	actions: IHistoryActions;

	constructor(private app: App) {
		this.actions = {};
		this.diff = [];
		this.diffRedo = [];
	}

	cleanStacks() {
		const diff = [];
		for (const d of this.diff) {
			diff.push({undo: d.undo, redo: d.redo});
		}
		const diff_redo = [];
		for (const d of this.diffRedo) {
			diff_redo.push({undo: d.undo, redo: d.redo});
		}
		this.diff = diff;
		this.diffRedo = diff_redo;
	}

	load() {
		try {
			const changes = readFileSync(join(this.app.path, 'changes.json'));
			this.diff = JSON.parse(changes.toString());
		} catch (e) {
			this.diff = [];
		}
	}

	/*save(opts?: ISaveOptions) {
		unused still undo / redo truely implemented
		if (opts && opts.beforeSave) {
			opts.beforeSave('changes.json')
		}
		this.cleanStacks()
		fs.writeFileSync(path.join(this.app.path, 'changes.json'), JSON.stringify(this.diff, null,  '\t'))
		if (opts && opts.afterSave) {
			opts.afterSave()
		}
	}*/

	/**
	Push an action in the history
	@param {object} - Redo action object
	@param {object} - Undo action object
	*/
	push(redo, undo) {
		this.diff.push({undo: undo, redo: redo});
		this.diffRedo = [];
		// this.save();
	}

	/**
	Register a type of action
	@param {string} - Type name
	@param {function} - Action's function
	*/
	register(type: any, action: (data: IActionData, opts: any) => Promise<any>) {
		this.actions[type] = action;
	}

	/**
	Is action(s) available in undo stack
	@returns {boolean}
	*/
	undoable() {
		return this.diff.length > 0;
	}

	/**
	Is action(s) available in redo stack
	@returns {boolean}
	*/
	redoable() {
		return this.diffRedo.length > 0;
	}

	/**
	Get the actions available in undo stack
	@returns {Array}
	*/
	getUndoStack() {
		return this.diff;
	}

	/**
	Get the actions available in redo stack
	@returns {Array}
	*/
	getRedoStack() {
		return this.diffRedo;
	}

	/**
	Undo the last action
	@param {object} - Action's options
	@returns {Promise<object>} the action applied
	*/
	undo(opts) {
		opts = opts || { history: false };
		if (this.diff.length === 0) {
			return Promise.resolve({});
		}
		const actionobj = this.diff.pop();
		this.diffRedo.push(actionobj);

		const action = this.actions[actionobj.undo.type];
		let p;
		if (actionobj.undo.table
			&& ! this.app.entities.get(actionobj.undo.table)
			&& actionobj.redo.type != MigrationType.CREATE_ENTITY
			&& actionobj.undo.type != MigrationType.DELETE_ENTITY
			&& actionobj.undo.type != MigrationType.RENAME_ENTITY
		) {
			p = Promise.resolve();
		} else {
			p = action(actionobj.undo, opts);
		}
		return p.then(() => {
			if (opts.save) {
				// this.save(opts);
			}
			return Promise.resolve(actionobj.undo);
		}).catch((err) => {
			if (opts.save) {
				// this.save(opts);
			}
			throw err;
		});
	}

	/**
	Redo the last cancelled action
	@param {object} - Action's options
	@returns {Promise<object>} the action applied
	*/
	redo(opts): Promise<any> {
		opts = opts || {history: false};
		if (this.diffRedo.length == 0) {
			return Promise.resolve({});
		}
		const actionobj = this.diffRedo.pop();
		this.diff.push(actionobj);

		const action = this.actions[actionobj.redo.type];
		let p;
		if (actionobj.redo.table
			&& ! this.app.entities.get(actionobj.redo.table)
			&& actionobj.redo.type != MigrationType.CREATE_ENTITY
			&& actionobj.redo.type != MigrationType.DELETE_ENTITY
			&& actionobj.redo.type != MigrationType.RENAME_ENTITY) {
				p = Promise.resolve();
		} else {
			p = action(actionobj.redo, opts);
		}
		return p.then(() => {
			if (opts.save) {
				// this.save(opts);
			}
			return Promise.resolve(actionobj.redo);
		}).catch((err) => {
			if (opts.save) {
				// this.save(opts);
			}
			throw err;
		});
	}

	/**
	Clear the history
	*/
	clear() {
		this.diff = [];
		this.diffRedo = [];
	}

	/**
	Revert actions from a diff array
	@param {Array<object>} - The diffs list
	@param {object} - Action's options
	@returns {Promise<Array>} the applied actions
	*/
	revert(diffs, opts): Promise<IActionData[]> {
		const diff_redo = this.diffRedo;
		const diff_undo = this.diff;

		this.diffRedo = [];
		this.diff = [];
		if (diffs && diffs.length) {
			for (const diff of diffs) {
				this.diff.push(diff);
			}
		}

		const actions = [];
		let p = Promise.resolve({ type: null });

		this.diff.forEach(() => {
			p = p.then((action) => {
				if (action.type) {
					actions.push(action);
				}
				return this.undo(opts);
			});
		});

		return p.then((action) => {
			if (action.type) {
				actions.push(action);
			}
			this.diffRedo = diff_redo;
			this.diff = diff_undo;
			return Promise.resolve(actions);
		}).catch((e) => {
			console.error('Could not revert', e.stack);
			this.diffRedo = diff_redo;
			this.diff = diff_undo;
			throw e;
		});
	}

	/**
	Apply actions from a diff array
	@param {Array<object>} - The diffs list
	@param {object} - Action's options
	@returns {Promise<Array>} the applied actions
	*/
	apply(diffs, opts): Promise<IActionData[]> {
		const diff_redo = this.diffRedo;
		const diff_undo = this.diff;

		this.diffRedo = [];
		this.diff = [];
		if (diffs && diffs.length) {
			for (const diff of diffs) {
				this.diffRedo.unshift(diff);
			}
		}

		const actions = [];
		let p = Promise.resolve({ type: null, table: null } as IActionData);

		this.diffRedo.forEach(() => {
			p = p.then((action) => {
				if (action.type) {
					actions.push(action);
				}
				return this.redo(opts);
			});
		});

		return p.then((action) => {
			if (action.type) {
				actions.push(action);
			}
			this.diffRedo = diff_redo;
			this.diff = diff_undo;

			return Promise.resolve(actions);
		}).catch((e) => {
			this.diffRedo = diff_redo;
			this.diff = diff_undo;
			throw e;
		});
	}
}
