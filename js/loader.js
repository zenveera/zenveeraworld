// ==============================
// ZENVEERA LOADER
// ==============================

window.hideLoader = function () {

    const loader = document.getElementById("preloader");

    if (!loader) return;

    loader.classList.add("hide");

    setTimeout(() => {

        loader.style.display = "none";

    }, 600);

};