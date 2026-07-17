// ========================================================
// IMS News & Updates Feed Initialization
// ========================================================

document.addEventListener("DOMContentLoaded", () => {
    console.log("Initializing CDRRMD Facebook News Feed...");

    // Dynamically inject the RSS.app widget script
    const rssScript = document.createElement("script");
    rssScript.src = "https://widget.rss.app/v1/imageboard.js";
    rssScript.type = "text/javascript";
    rssScript.async = true;

    // Append the script to the body to load the Facebook feed
    document.body.appendChild(rssScript);
});