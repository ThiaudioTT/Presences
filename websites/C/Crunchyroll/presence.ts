const presence = new Presence({
	clientId: "608065709741965327",
});

const enum Assets {
	Logo = "https://i.imgur.com/yeWzAvq.png",

	OpenBook = "https://i.imgur.com/H4ZhsMF.png",
}

async function getStrings() {
	return presence.getStrings(
		{
			play: "general.playing",
			pause: "general.paused",
			browse: "general.browsing",
			reading: "general.reading",
			viewPage: "general.viewPage",
			viewManga: "general.viewManga",
			viewSeries: "general.buttonViewSeries",
			watchEpisode: "general.buttonViewEpisode",
			readingArticle: "general.readingArticle",
			viewCategory: "general.viewCategory",
			chapter: "general.chapter",
			search: "general.search",
			manga: "general.manga",
			page: "general.page",
		},
		await presence.getSetting<string>("lang").catch(() => "en")
	);
}

let strings: Awaited<ReturnType<typeof getStrings>>,
	oldLang: string = null,
	lastPlaybackState = null,
	playback: boolean,
	browsingTimestamp = Math.floor(Date.now() / 1000);

if (lastPlaybackState !== playback) {
	lastPlaybackState = playback;
	browsingTimestamp = Math.floor(Date.now() / 1000);
}

let iFrameVideo: boolean,
	currentTime: number,
	duration: number,
	paused: boolean;

interface iFrameData {
	iFrameVideoData: {
		iFrameVideo: boolean;
		currTime: number;
		dur: number;
		paused: boolean;
	};
}

presence.on("iFrameData", (data: iFrameData) => {
	playback = data.iFrameVideoData !== null ? true : false;

	if (playback) {
		({
			iFrameVideo,
			currTime: currentTime,
			dur: duration,
			paused,
		} = data.iFrameVideoData);
	}
});

presence.on("UpdateData", async () => {
	const presenceData: PresenceData = {
			largeImageKey: Assets.Logo,
		},
		{ href, pathname } = window.location,
		[newLang, showCover] = await Promise.all([
			presence.getSetting<string>("lang").catch(() => "en"),
			presence.getSetting<boolean>("cover"),
		]);

	if (oldLang !== newLang || !strings) {
		oldLang = newLang;
		strings = await getStrings();
	}

	if (pathname.includes("/manga")) {
		if (pathname.includes("/read")) {
			const queryTitle =
				document.querySelector<HTMLHeadingElement>(".chapter-header h1");
			presenceData.details = queryTitle.children[0].textContent.trim();
			presenceData.state = `${
				strings.reading
			} ${queryTitle.lastChild.textContent.trim()}`;
			presenceData.startTimestamp = browsingTimestamp;
			presenceData.smallImageKey = Assets.OpenBook;
			const pageNumber: string =
				document.querySelector<HTMLOutputElement>(
					".first-page-number"
				).textContent;
			presenceData.smallImageText = `${strings.page} ${
				pageNumber === "" ? "1" : pageNumber
			}/${document.querySelector<HTMLOListElement>(".images").children.length}`;
			presenceData.buttons = [
				{
					label: `Read ${strings.chapter}`,
					url: href,
				},
			];
		} else if (pathname.includes("/volumes")) {
			presenceData.details = strings.viewManga;
			presenceData.state = document
				.querySelector<HTMLHeadingElement>(".ellipsis")
				.textContent.split("Manga > ")[1];
			presenceData.buttons = [
				{
					label: `View ${strings.manga}`,
					url: href,
				},
			];
		} else {
			presenceData.details = strings.browse;
			presenceData.startTimestamp = browsingTimestamp;

			delete presenceData.state;
			delete presenceData.smallImageKey;
		}
	} else if (
		iFrameVideo !== false &&
		!isNaN(duration) &&
		pathname.includes("/watch/")
	) {
		const videoTitle =
			document.querySelector<HTMLHeadingElement>("a > h4").textContent;
		presenceData.smallImageKey = paused ? Assets.Pause : Assets.Play;
		presenceData.smallImageText = paused ? strings.pause : strings.play;
		[, presenceData.endTimestamp] = presence.getTimestamps(
			Math.floor(currentTime),
			Math.floor(duration)
		);

		presenceData.details = videoTitle ?? "Title not found...";
		presenceData.state =
			document.querySelector<HTMLHeadingElement>("h1.title").textContent;

		presenceData.largeImageKey =
			document.querySelector<HTMLMetaElement>("[property='og:image']")
				?.content ?? Assets.Logo;

		if (paused) {
			delete presenceData.startTimestamp;
			delete presenceData.endTimestamp;
		}

		if (videoTitle) {
			presenceData.buttons = [
				{
					label: strings.watchEpisode,
					url: href,
				},
				{
					label: strings.viewSeries,
					url: document.querySelector<HTMLAnchorElement>(".show-title-link")
						.href,
				},
			];
		}
	} else if (pathname.includes("/series")) {
		presenceData.details = strings.viewPage;
		presenceData.state =
			document.querySelector<HTMLHeadingElement>("h1.title").textContent;
		presenceData.largeImageKey =
			document.querySelector<HTMLMetaElement>("[property='og:image']")
				?.content ?? Assets.Logo;
		presenceData.buttons = [
			{
				label: strings.viewSeries,
				url: href,
			},
		];
	} else if (pathname.includes("/search")) {
		presenceData.details = strings.search;
		presenceData.state =
			document.querySelector<HTMLInputElement>(".search-input").value;
		presenceData.smallImageKey = Assets.Search;
	} else if (pathname.includes("/simulcasts")) {
		presenceData.details = strings.viewPage;
		presenceData.state = `${
			document.querySelector("h1 + div span").textContent
		} ${document.querySelector("h1").textContent}`;
	} else if (pathname.includes("/videos")) {
		presenceData.details = strings.viewCategory;
		presenceData.state = document.querySelector("h1").textContent;
	} else if (/\/anime-.*?\/\d{4}\//.test(pathname)) {
		presenceData.details = strings.readingArticle;
		presenceData.state = document.querySelector<HTMLHeadingElement>(
			".crunchynews-header"
		).textContent;
		if (showCover) {
			presenceData.largeImageKey =
				document.querySelector<HTMLImageElement>(".mug").src;
		}
	} else {
		presenceData.details = strings.browse;
		presenceData.startTimestamp = browsingTimestamp;

		delete presenceData.state;
		delete presenceData.smallImageKey;
	}

	if (!showCover) presenceData.largeImageKey = Assets.Logo;

	if (presenceData.details) presence.setActivity(presenceData);
	else presence.setActivity();
});
