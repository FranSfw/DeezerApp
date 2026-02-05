const btn = document.getElementById('btnBuscar');
const input = document.getElementById('buscador');
const contenedor = document.getElementById('resultados');

// Cargar datos JSONP
function cargarJSONP(url) {
    return new Promise((resolve, reject) => {
        const nombreCallback = 'deezer_callback_' + Math.round(100000 * Math.random());

        window[nombreCallback] = function (data) {
            delete window[nombreCallback];
            document.body.removeChild(script);
            resolve(data);
        };

        const script = document.createElement('script');
        script.src = `${url}&output=jsonp&callback=${nombreCallback}`;
        script.onerror = () => {
            delete window[nombreCallback];
            document.body.removeChild(script);
            reject(new Error('Falló la carga JSONP'));
        };
        document.body.appendChild(script);
    });
}

// Buscar artista y canciones
async function buscarArtista(nombreArtista) {
    try {
        const urlBusqueda = `https://api.deezer.com/search/artist?q=${encodeURIComponent(nombreArtista)}`;

        const dataBusqueda = await cargarJSONP(urlBusqueda);

        if (!dataBusqueda.data || dataBusqueda.data.length === 0) {
            throw new Error("Artista no encontrado");
        }

        const artistaExacto = dataBusqueda.data[0];
        // console.log(`Artista encontrado: ${artistaExacto.name} (ID: ${artistaExacto.id})`);

        const urlTracks = `https://api.deezer.com/artist/${artistaExacto.id}/top?limit=50`;
        const dataTracks = await cargarJSONP(urlTracks);

        if (dataTracks.error) {
            throw new Error(dataTracks.error.message);
        }

        // console.log("Canciones encontradas:", dataTracks.data);
        return dataTracks.data;

    } catch (error) {
        // console.error("Hubo un problema:", error);
        return null;
    }
}

// buscarArtista("Daft Punk");

btn.addEventListener('click', async () => {
    const busqueda = input.value;
    if (!busqueda) return;

    contenedor.innerHTML = 'Cargando...';

    const canciones = await buscarArtista(busqueda);

    if (!canciones || canciones.length === 0) {
        contenedor.innerHTML = '<p>No se encontraron resultados o hubo un error.</p>';
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
            <audio controls src="${cancion.preview}"></audio>
        `;
        contenedor.appendChild(card);
    });
});

input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        btn.click();
    }
});