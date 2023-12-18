export class DebuggerGUI {
    rootElement;
    contentElement;

    constructor() {
        this.rootElement = document.createElement('div');

            this.rootElement.style.cssText = `
                background-color: rgb(200 200 255 / 70%);
                position: absolute;
                top: 0px;
                right: 0px;
                box-sizing: border-box;
                padding: 0px 10px 10px 10px;
                display: grid;
                justify-items: start;
               
                font-family: sans-serif;
                font-size: 9px;
                font-weight: bold;
                line-height: 1.2em;
                min-width: 200px;
        `;

        this.contentElement = document.createElement('div');
        this.contentElement.style.cssText = `
            width: 100%;
        `;
        this.rootElement.appendChild(this.contentElement);
    }

    #createDebuggerContentElement(label) {
        const wrapperElement = document.createElement('div');

        wrapperElement.style.cssText = `
            box-sizing: border-box;
            padding-top: 8px;
        `;

        const headerElement = document.createElement('div');
        wrapperElement.appendChild(headerElement);

        if (label) {
            const labelTextElement = document.createElement('span');
            labelTextElement.style.cssText = `
                padding-right: 1em;
            `;
            labelTextElement.textContent = label;

            headerElement.appendChild(labelTextElement);
        }

        const contentElement = document.createElement('div');
        wrapperElement.appendChild(contentElement);

        return {
            wrapperElement,
            headerElement,
            contentElement,
        };
    }

    addSliderDebugger({
                          label,
                          onChange,
                          onInput,
                          initialValue,
                          initialExec = true,
                          minValue,
                          maxValue,
                          stepValue,
                      }) {
        const {wrapperElement, headerElement, contentElement} = this.#createDebuggerContentElement(label);

        const sliderValueView = document.createElement('span');
        const sliderInput = document.createElement('input');

        const updateCurrentValueView = () => {
            sliderValueView.textContent = `value: ${sliderInput.value}`;
        };

        const onUpdateSlider = () => {
            updateCurrentValueView();
            return Number.parseFloat(sliderInput.value);
        };

        sliderInput.type = 'range';
        sliderInput.min = minValue.toString();
        sliderInput.max = maxValue.toString();
        if (stepValue !== null) {
            sliderInput.step = stepValue.toString();
        }
        sliderInput.addEventListener('change', () => {
            return onUpdateSlider();
        });
        sliderInput.addEventListener('input', () => {
            onInput ? onInput(onUpdateSlider()) : onChange(onUpdateSlider());
        });

        if (initialValue !== null) {
            sliderInput.value = initialValue.toString();
        }
        if (initialExec) {
            onChange(onUpdateSlider());
        } else {
            updateCurrentValueView();
        }

        headerElement.appendChild(sliderValueView);
        contentElement.appendChild(sliderInput);

        // (parent ? parent : this.contentElement).appendChild(wrapperElement);
        this.contentElement.appendChild(wrapperElement);
    }

    addButtonDebugger({
                          buttonLabel,
                          onClick, // onInput,
                      }) {
        const {wrapperElement, contentElement} = this.#createDebuggerContentElement('');

        const buttonInput = document.createElement('input');
        buttonInput.type = 'button';
        buttonInput.value = buttonLabel;

        buttonInput.style.cssText = `
        font-size: 9px;
        font-weight: bold;
        line-height: 1.2em;
        padding: 1px 2px;
`;

        buttonInput.addEventListener('click', () => onClick());

        contentElement.appendChild(buttonInput);
        this.contentElement.appendChild(wrapperElement);
    }

    addBorderSpacer() {
        const borderElement = document.createElement('hr');
        borderElement.style.cssText = `
            width: 100%;
            height: 1px;
            border: none;
            border-top: 1px solid #777;
            margin: 0.5em 0 0.25em 0;
        `;
        this.contentElement.appendChild(borderElement);
    }

    addText(text) {
        const textElement = document.createElement('p');
        textElement.style.cssText = `
            font-size: 11px;
            font-weight: bold;
            box-sizing: border-box;
            padding: 0.75em 0 0.25em 0
        `;
        textElement.textContent = text;
        this.contentElement.appendChild(textElement);
        return textElement;
    }
}
