import assert from 'node:assert';

function extractComputedStyleProperty(element, property, getStyleFn) {
	if (!element) return undefined;
	const val = getStyleFn(element).getPropertyValue(property).trim();
	return val.length > 0 ? val : undefined;
}

function extractTypographyFromElements(contentEl, selectionEl, cursorEl, getStyleFn) {
	return {
		codeColor: extractComputedStyleProperty(contentEl, 'color', getStyleFn),
		fontFamily: extractComputedStyleProperty(contentEl, 'font-family', getStyleFn),
		selectionColor: extractComputedStyleProperty(selectionEl, 'background-color', getStyleFn),
		caretColor: extractComputedStyleProperty(cursorEl, 'border-left-color', getStyleFn),
	};
}

function createCssVariablesByTypography(props) {
	const variableByPropKey = new Map();
	if (props.codeColor) variableByPropKey.set('--wanim-code-color', props.codeColor);
	if (props.fontFamily) variableByPropKey.set('--wanim-code-font-family', props.fontFamily);
	if (props.selectionColor) variableByPropKey.set('--wanim-selection-color', props.selectionColor);
	if (props.caretColor) variableByPropKey.set('--wanim-caret-color', props.caretColor);
	return variableByPropKey;
}

const mockStyles = {
	content: { color: 'rgb(220, 220, 220)', 'font-family': 'JetBrains Mono' },
	selection: { 'background-color': 'rgba(255, 255, 255, 0.2)' },
	cursor: { 'border-left-color': 'rgb(255, 255, 255)' }
};

const fakeGetStyle = (el) => ({
	getPropertyValue: (prop) => mockStyles[el.type]?.[prop] || ''
});

const typo = extractTypographyFromElements(
	{ type: 'content' },
	{ type: 'selection' },
	{ type: 'cursor' },
	fakeGetStyle
);

const vars = createCssVariablesByTypography(typo);

assert.strictEqual(vars.get('--wanim-code-color'), 'rgb(220, 220, 220)');
assert.strictEqual(vars.get('--wanim-code-font-family'), 'JetBrains Mono');
assert.strictEqual(vars.get('--wanim-selection-color'), 'rgba(255, 255, 255, 0.2)');
assert.strictEqual(vars.get('--wanim-caret-color'), 'rgb(255, 255, 255)');

console.log('✓ Typography helper test passed.');
