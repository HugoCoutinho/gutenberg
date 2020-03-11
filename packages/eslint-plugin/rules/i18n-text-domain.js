/**
 * Internal dependencies
 */
const { TRANSLATION_FUNCTIONS } = require( '../util' );

const STATUS = {
	MISSING: 'missing',
	INVALID_VALUE: 'invalid-domain',
	INVALID_TYPE: 'invalid-type',
	VALID: 'valid',
};

function validateTextDomain( functionName, args, allowedTextDomains ) {
	switch ( functionName ) {
		case '__':
			if ( args.length < 2 ) {
				return STATUS.MISSING;
			}
			break;
		case '_x':
			if ( args.length < 3 ) {
				return STATUS.MISSING;
			}

			break;
		case '_n':
			if ( args.length < 4 ) {
				return STATUS.MISSING;
			}

			break;
		case '_nx':
			if ( args.length < 5 ) {
				return STATUS.MISSING;
			}

			break;
		default:
			break;
	}

	const textDomain = getTextDomain( functionName, args );

	if ( ! textDomain ) {
		return STATUS.INVALID_TYPE;
	}

	const { type, value } = textDomain;

	if ( type !== 'Literal' ) {
		return STATUS.INVALID_TYPE;
	}

	if ( ! allowedTextDomains.includes( value ) ) {
		return STATUS.INVALID_VALUE;
	}

	return STATUS.VALID;
}

function getTextDomain( functionName, args ) {
	switch ( functionName ) {
		case '__':
			return args[ 1 ];
		case '_x':
			return args[ 2 ];
		case '_n':
			return args[ 3 ];
		case '_nx':
			return args[ 4 ];
		default:
			return {};
	}
}

module.exports = {
	meta: {
		type: 'problem',
		schema: [
			{
				type: 'object',
				properties: {
					allowDefault: {
						type: 'boolean',
						default: false,
					},
					allowedTextDomains: {
						type: 'array',
						items: {
							type: 'string',
						},
						uniqueItems: true,
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			invalidValue: "Invalid text domain '{{ textDomain }}'",
			invalidType: 'Text domain is not a string literal',
			unnecessaryDefault: 'Unnecessary default text domain',
			missing: 'Missing text domain',
			useAllowedValue:
				'Use one of the whitelisted text domains: {{ textDomains }}',
		},
		fixable: 'code',
	},
	create( context ) {
		const options = context.options[ 0 ] || {};
		const { allowDefault, allowedTextDomains = [] } = options;

		return {
			CallExpression( node ) {
				const { callee, arguments: args } = node;
				if ( ! TRANSLATION_FUNCTIONS.includes( callee.name ) ) {
					return;
				}

				const status = validateTextDomain(
					callee.name,
					args,
					allowedTextDomains
				);

				switch ( status ) {
					case STATUS.MISSING:
						if ( ! allowDefault ) {
							const lastArg = args[ args.length - 1 ];

							context.report( {
								node,
								messageId: 'missing',
								fix:
									allowedTextDomains.length === 1
										? ( fixer ) => {
												return fixer.insertTextAfter(
													lastArg,
													`, '${ allowedTextDomains[ 0 ] }'`
												);
										  }
										: null,
							} );
						}
						break;
					case STATUS.INVALID_TYPE:
						context.report( {
							node,
							messageId: 'invalidType',
						} );
						break;
					case STATUS.INVALID_VALUE:
						const textDomain = getTextDomain( callee.name, args );
						const { value, range, parent } = textDomain;

						const previousArg = [ ...parent.arguments ] // avoids reverse() modifying the AST.
							.reverse()
							.find( ( arg ) => arg.range[ 1 ] < range[ 0 ] );

						if ( 'default' === value && allowDefault ) {
							context.report( {
								node,
								messageId: 'unnecessaryDefault',
								fix: ( fixer ) => {
									return fixer.removeRange( [
										previousArg.range[ 1 ],
										range[ 1 ],
									] );
								},
							} );
							break;
						}

						context.report( {
							node,
							messageId: 'invalidValue',
							data: {
								textDomain: value,
							},
							fix:
								allowedTextDomains.length === 1
									? ( fixer ) => {
											return fixer.replaceTextRange(
												// account for quotes.
												[
													range[ 0 ] + 1,
													range[ 1 ] - 1,
												],
												allowedTextDomains[ 0 ]
											);
									  }
									: null,
						} );
						break;
					default:
						break;
				}
			},
		};
	},
};
