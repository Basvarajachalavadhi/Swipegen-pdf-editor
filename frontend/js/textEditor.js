class TextEditor {
    constructor() {
        this.selectedElement = null;
        this.isSelectionEnabled = false;
        this.initializeTextEditing();
    }

    initializeTextEditing() {
        // Use event delegation for better performance
        document.addEventListener('click', (e) => {
            // Check if the clicked element or its parent is a text element
            const textElement = e.target.closest('.text-element');
            
            if (textElement && this.isSelectionEnabled) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Text element clicked:', textElement.textContent);
                this.selectTextElement(textElement);
            }
        });

        // Enable text selection by default
        this.enableSelection();
    }

    enableSelection() {
        this.isSelectionEnabled = true;
        console.log('Text selection enabled');
        
        // Make all text elements visible and clickable
        const textElements = document.querySelectorAll('.text-element');
        textElements.forEach(element => {
            element.style.pointerEvents = 'auto';
            element.style.cursor = 'pointer';
            element.style.zIndex = '1000';
        });
        
        return true;
    }

    disableSelection() {
        this.isSelectionEnabled = false;
        console.log('Text selection disabled');
        
        const textElements = document.querySelectorAll('.text-element');
        textElements.forEach(element => {
            element.style.pointerEvents = 'none';
            element.style.cursor = 'default';
        });
    }

    selectTextElement(element) {
        if (!this.isSelectionEnabled) {
            console.warn('Text selection is disabled');
            return;
        }

        console.log('Selecting text element:', element.textContent);
        
        // Remove selection from previous element
        if (this.selectedElement) {
            this.selectedElement.classList.remove('selected');
            this.selectedElement.style.backgroundColor = 'rgba(255, 0, 0, 0.6)';
            this.selectedElement.style.border = '2px solid yellow';
            this.selectedElement.style.color = 'white';
            this.selectedElement.style.transform = 'scale(1)';
        }
        
        // Select new element
        this.selectedElement = element;
        element.classList.add('selected');
        element.style.backgroundColor = 'rgba(0, 255, 0, 0.8)';
        element.style.border = '3px solid #00ff00';
        element.style.color = 'black';
        element.style.transform = 'scale(1.1)';
        element.style.zIndex = '2000';
        
        // Dispatch custom event for the main app to handle
        const selectionEvent = new CustomEvent('textSelected', {
            detail: {
                element: element,
                text: element.textContent,
                originalText: element.dataset.originalText,
                page: element.dataset.page
            }
        });
        document.dispatchEvent(selectionEvent);
        
        console.log('Text element selected successfully:', element.textContent);
    }

    deselectTextElement() {
        if (this.selectedElement) {
            this.selectedElement.classList.remove('selected');
            this.selectedElement.style.backgroundColor = 'rgba(255, 0, 0, 0.6)';
            this.selectedElement.style.border = '2px solid yellow';
            this.selectedElement.style.color = 'white';
            this.selectedElement.style.transform = 'scale(1)';
            this.selectedElement = null;
        }
    }

    getSelectedText() {
        return this.selectedElement ? this.selectedElement.textContent : null;
    }

    getSelectedElement() {
        return this.selectedElement;
    }

    updateSelectedText(newText) {
        if (this.selectedElement) {
            this.selectedElement.textContent = newText;
            return true;
        }
        return false;
    }

    // Force make all text elements visible for debugging
    showAllTextElements() {
        const textElements = document.querySelectorAll('.text-element');
        console.log(`Found ${textElements.length} text elements`);
        
        textElements.forEach((element, index) => {
            element.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
            element.style.border = '3px solid yellow';
            element.style.color = 'white';
            element.style.fontSize = '14px';
            element.style.fontWeight = 'bold';
            element.style.zIndex = '1000';
            element.style.pointerEvents = 'auto';
            element.style.cursor = 'pointer';
            
            // Add number labels for debugging
            const label = document.createElement('span');
            label.textContent = `[${index}]`;
            label.style.background = 'black';
            label.style.color = 'white';
            label.style.padding = '2px 4px';
            label.style.marginLeft = '5px';
            label.style.borderRadius = '3px';
            label.style.fontSize = '10px';
            
            element.appendChild(label);
        });
        
        return textElements.length;
    }

    // Test if text elements are clickable
    testSelection() {
        const textElements = document.querySelectorAll('.text-element');
        if (textElements.length === 0) {
            console.error('No text elements found for testing');
            return false;
        }
        
        console.log(`Testing selection with ${textElements.length} text elements`);
        
        // Try to programmatically click the first element
        if (textElements[0]) {
            textElements[0].click();
            console.log('Test click executed on first text element');
            return true;
        }
        
        return false;
    }
}

// Initialize the text editor
document.addEventListener('DOMContentLoaded', () => {
    window.textEditor = new TextEditor();
    console.log('Text Editor initialized with enhanced selection');
});