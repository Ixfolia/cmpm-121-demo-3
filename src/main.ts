document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');
    if (app) {
        const button = document.createElement('button');
        button.innerText = 'Click Me';
        button.addEventListener('click', () => {
            alert('you clicked the button!');
        });
        app.appendChild(button);
    }
});