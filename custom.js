const btn = document.getElementById('btnBuscar');
const input = document.getElementById('buscador');
const contenedor = document.getElementById('resultados');

// Circuit Breaker
class CircuitBreaker {
    constructor(requestFunction, options = {}) {
        this.requestFunction = requestFunction;
        this.failureThreshold = options.failureThreshold || 3;
        this.recoveryTimeout = options.recoveryTimeout || 10000;

        this.state = 'CLOSED';
        this.failureCount = 0;
        this.nextAttempt = Date.now();
    }

    async fire(...args) {
        if (this.state === 'OPEN') {
            if (Date.now() > this.nextAttempt) {
                this.state = 'HALF_OPEN';
                console.log('Circuit Breaker: Estado HALF-OPEN (Probando conexión...)');
            } else {
                const timeLeft = Math.ceil((this.nextAttempt - Date.now()) / 1000);
                const error = new Error(`El servicio no está disponible temporalmente. Intenta de nuevo en ${timeLeft}s.`);
                error.isCircuitBreakerOpen = true;
                throw error;
            }
        }

        try {
            const response = await this.requestFunction(...args);
            this.success();
            return response;
        } catch (error) {
            this.failure();
            throw error;
        }
    }

    success() {
        this.failureCount = 0;
        if (this.state !== 'CLOSED') {
            this.state = 'CLOSED';
            console.log('Circuit Breaker: Estado CLOSED (Servicio recuperado)');
        }
    }

    failure() {
        this.failureCount++;
        // Log estilizado: Naranja para advertencia
        console.log(`%cCircuit Breaker: Fallo ${this.failureCount}/${this.failureThreshold}`, 'color: red;');

        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.recoveryTimeout;
            // Log estilizado: Rojo pero como log informativo
            console.log(`%cCircuit Breaker: Abierto. Pausando por ${this.recoveryTimeout / 1000}s`, 'color: yellow;');
        }
    }
}

// Cargar datos JSONP
function cargarJSONP(url) {
    return new Promise((resolve, reject) => {
        const nombreCallback = 'deezer_callback_' + Math.round(100000 * Math.random());

        // Timeout para evitar que se quede colgado eternamente si la red falla
        const timeoutId = setTimeout(() => {
            limpiar();
            reject(new Error('Tiempo de espera agotado (Timeout)'));
        }, 5000);

        function limpiar() {
            delete window[nombreCallback];
            if (script.parentNode) {
                document.body.removeChild(script);
            }
            clearTimeout(timeoutId);
        }

        window[nombreCallback] = function (data) {
            limpiar();
            if (data.error) {
                reject(new Error(data.error.message || 'Error en la API de Deezer'));
            } else {
                resolve(data);
            }
        };

        const script = document.createElement('script');
        script.src = `${url}&output=jsonp&callback=${nombreCallback}`;
        script.onerror = () => {
            limpiar();
            reject(new Error('Error de Conexión'));
        };
        document.body.appendChild(script);
    });
}

async function realizarBusqueda(busqueda) {
    const urlBusqueda = `https://api.deezer.com/search/artist?q=${encodeURIComponent(busqueda)}`;
    const dataBusqueda = await cargarJSONP(urlBusqueda);

    if (!dataBusqueda.data || dataBusqueda.data.length === 0) {
        throw new Error("Artista no encontrado");
    }

    const artistaExacto = dataBusqueda.data[0];
    const urlTracks = `https://api.deezer.com/artist/${artistaExacto.id}/top?limit=20`;
    const dataTracks = await cargarJSONP(urlTracks);

    if (dataTracks.error) {
        throw new Error(dataTracks.error.message);
    }

    return dataTracks.data;
}

const buscadorCircuitBreaker = new CircuitBreaker(realizarBusqueda, {
    failureThreshold: 3,
    recoveryTimeout: 10000
});
btn.addEventListener('click', async () => {
    const busqueda = input.value;
    if (!busqueda) return;

    contenedor.innerHTML = '<div class="loader">Cargando...</div>';

    try {
        const canciones = await buscadorCircuitBreaker.fire(busqueda);

        if (!canciones || canciones.length === 0) {
            contenedor.innerHTML = '<p>No se encontraron resultados.</p>';
            return;
        }

        contenedor.innerHTML = '';
        canciones.forEach(cancion => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <img src="${cancion.album.cover_medium}" alt="${cancion.title}">
                <h3>${cancion.title}</h3>
                <p>${cancion.artist.name}</p>
                <audio controls preload="none" src="${cancion.preview}"></audio>
            `;
            contenedor.appendChild(card);
        });

    } catch (error) {
        // Error controlado sin ensuciar la consola
        console.log(`%cError controlado: ${error.message}`, 'color: grey; font-style: italic;');
        if (error.isCircuitBreakerOpen) {
            // contenedor.innerHTML = `<p style="color: darkred; font-weight: bold; padding: 10px; background: #fff0f0; border: 1px solid #ffcccc; border-radius: 5px;">${error.message}</p>`;
            contenedor.innerHTML = `<p style="color: darkred; font-weight: bold; padding: 10px; background: #fff0f0; border: 1px solid #ffcccc; border-radius: 5px; text-align: center; font-size: 8px;">
                 ▄██████████▄     <br>
               ▄██████████████▄   <br>
              ██████████████████  <br>
             ▐███▀▀▀▀▀██▀▀▀▀▀███▌ <br>
             ███▒▒▌■▐▒▒▒▒▌■▐▒▒███ <br>
             ▐██▄▒▀▀▀▒▒▒▒▀▀▀▒▄██▌ <br>
              ▀████▒▄▄▒▒▄▄▒████▀  <br>
              ▐███▒▒▒▀▒▒▀▒▒▒███▌  <br>
              ███▒▒▒▒▒▒▒▒▒▒▒▒███  <br>
               ██▒▒▀▀▀▀▀▀▀▀▒▒██   <br>
               ▐██▄▒▒▒▒▒▒▒▒▄██▌   <br>
                ▀████████████▀    </p>`;

        } else {
            contenedor.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        }
    }
});

input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        btn.click();
    }
});