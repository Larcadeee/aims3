

const FB_PAGE_ID = "1424151444262464";
const FB_ACCESS_TOKEN = "EAATZAeMV0gKABSD2TSdAbYEmuMZBzwLaBSMN4D1i2JZA12LVzoIHpCvTMKzxOo7J0LZB6gZApT2WBxbuv38fFkK55TTEo1t2gZCBfLFi0h6mJNkVG7V0QC48VZB53kZAegTCusdFVjHHRS5ACk9NnW5rdin42BVP0BlDJmYXlKBCY86ZBBdRvrw4pfCRC1G7XBLBinTPsqZBjF";

const API_URL = `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/posts?fields=message,created_time,full_picture,permalink_url,story&limit=9&access_token=${FB_ACCESS_TOKEN}`;

document.addEventListener("DOMContentLoaded", fetchFacebookFeed);

async function fetchFacebookFeed() {
    const container = document.getElementById("fb-feed-container");

    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        if (data.error) throw new Error(data.error.message);

        const posts = data.data;

        if (!posts || posts.length === 0) {
            container.innerHTML = `<div class="news-loading">No recent posts found on the page.</div>`;
            return;
        }

        container.innerHTML = "";

        posts.forEach((post, index) => {
            const postText = post.message || post.story || "View update on Facebook";
            const imageUrl = post.full_picture;
            const postUrl = post.permalink_url;
            
            const dateObj = new Date(post.created_time);
            const dateString = dateObj.toLocaleDateString('en-US', { 
                month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            // --- Bento Box Logic ---
            let bentoClass = "";
            
            // Post 1: Large Hero (Only if it has an image, otherwise default to Wide)
            if (index === 0 && imageUrl) bentoClass = "bento-hero";
            else if (index === 0 && !imageUrl) bentoClass = "bento-wide";
            
            // Post 4: Tall Portrait Box
            else if (index === 3 && imageUrl) bentoClass = "bento-tall";
            
            // Post 7: Wide Landscape Box
            else if (index === 6 && imageUrl) bentoClass = "bento-wide";

            // If the hero has a dark image background, turn the Facebook icon white
            const iconColor = bentoClass === 'bento-hero' ? 'color: #ffffff;' : 'color: #1877F2;';

            // --- Build Card ---
            const card = document.createElement("div");
            card.className = `fb-post-card ${bentoClass}`;

            let imageHTML = "";
            if (imageUrl) {
                imageHTML = `<img src="${imageUrl}" alt="News Image" class="fb-post-img" loading="lazy">`;
            }

            card.innerHTML = `
                ${imageHTML}
                <div class="fb-post-content">
                    <div class="fb-post-date"><i class="fa-brands fa-facebook" style="${iconColor}"></i> ${dateString}</div>
                    <p class="fb-post-message">${postText}</p>
                    <a href="${postUrl}" target="_blank" rel="noopener noreferrer" class="fb-post-link">Read on Facebook</a>
                </div>
            `;

            container.appendChild(card);
        });

    } catch (error) {
        console.error("Facebook API Error:", error);
        container.innerHTML = `
            <div class="news-error" style="grid-column: 1 / -1; text-align: center; color: #ef4444; background: #fef2f2; padding: 20px; border-radius: 8px; border: 1px solid #fecaca;">
                <i class="fa-solid fa-triangle-exclamation" style="margin-bottom: 10px; font-size: 24px;"></i><br>
                <b>Unable to load news feed.</b><br>
                <small>${error.message}</small>
            </div>
        `;
    }
}