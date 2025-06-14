const Bot = require('@maxhub/max-bot-api').Bot;
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const db = require('./database');
require('dotenv').config();

const token = process.env.MAX_BOT_TOKEN;
const maxStorageSize = parseInt(process.env.MAX_STORAGE_SIZE, 10);

const bot = new Bot(token);

bot.on('bot_started', (ctx) => {
	console.log('/start');
	ctx.reply('Welcome to YouTube Downloader Bot!');
});

bot.hears(/\/video (.+)/, async (ctx) => {
	const res = /\/video (.+)/.exec(ctx.message.body.text);
	const [_, url] = res;

	console.log('/video', url);

	if (!ytdl.validateURL(url)) {
		ctx.reply('Invalid YouTube URL.');

		return;
	}

	const info = await ytdl.getBasicInfo(url);

	const videoId = info.videoDetails.videoId;
	const title = info.videoDetails.title;
	const duration = parseInt(info.videoDetails.lengthSeconds, 10);
	const thumbnail = info.videoDetails.thumbnails[0].url;

	console.log('Video ID:', videoId);

	await ctx.reply(`Downloading "${title}" (${duration} seconds)...`);

	db.get('SELECT * FROM videos WHERE id = ?', [videoId], async (err, row) => {
		if (row) {
			const image = await ctx.api.uploadImage({ url: thumbnail });
			await ctx.reply(`Already downloaded: "${title}"`, { attachments: [image.toJson()] });

			const video = await ctx.api.uploadFile({
				source: fs.readFileSync(row.filePath),
			});
			await ctx.reply('', { attachments: [video.toJson()] });
		} else {
			const filePath = path.resolve(__dirname, 'downloads', `${videoId}.mp4`);
			// const videoStream = ytdl(url, { quality: 'highestvideo' });
			const fileStream = fs.createWriteStream(filePath);

			try {
				ytdl(url, { quality: 'highestvideo' }).pipe(fileStream);
			} catch (error) {
				console.log('==== Error:', error);

				return;
			}

			// videoStream.pipe(fileStream);

			fileStream.on('finish', () => {
				console.log('Video downloaded', videoId);

				const fileSize = fs.statSync(filePath).size;

				db.run(
					'INSERT INTO videos (id, title, duration, filePath, downloadTime, downloadCount, fileSize) VALUES (?, ?, ?, ?, ?, ?, ?)',
					[videoId, title, duration, filePath, Date.now(), 1, fileSize],
					async (err) => {
						if (err) {
							console.error(err);

							return;
						}

						const image = await ctx.api.uploadImage({ url: thumbnail });
						await ctx.reply(`Downloaded: "${title}"`, { attachments: [image.toJson()] });

						const video = await ctx.api.uploadFile({
							source: fs.readFileSync(filePath),
						});
						await ctx.reply('', { attachments: [video.toJson()] });

						manageStorage();
					}
				);
			});
		}
	});
});

bot.hears(/\/audio (.+)/, async (ctx) => {
	const res = /\/audio (.+)/.exec(ctx.message.body.text);
	const [_, url] = res;

	console.log('/audio', url);

	if (!ytdl.validateURL(url)) {
		ctx.reply('Invalid YouTube URL.');

		return;
	}

	const info = await ytdl.getBasicInfo(url);
	const videoId = info.videoDetails.videoId;
	const title = info.videoDetails.title;

	ctx.reply(`Downloading audio for "${title}"...`);

	const filePath = path.resolve(__dirname, 'downloads', `${videoId}.mp3`);
	const audioStream = ytdl(url, { filter: 'audioonly' });
	const fileStream = fs.createWriteStream(filePath);

	audioStream.pipe(fileStream);

	fileStream.on('finish', async () => {
		const audio = await ctx.api.uploadFile({
			source: fs.readFileSync(filePath),
		});
		await ctx.reply(`Audio downloaded: "${title}"`, { attachments: [audio.toJson()] });
	});
});

bot.hears(/\/top/, async (ctx) => {
	console.log('/top');

	db.all('SELECT title, downloadCount FROM videos ORDER BY downloadCount DESC LIMIT 10', [], (err, rows) => {
		if (err) {
			console.error(err);
			return;
		}

		const topVideos = rows.map((row, index) => `${index + 1}. ${row.title} - ${row.downloadCount} downloads`).join('\n');

		ctx.reply(`Top 10 downloaded videos:\n${topVideos}`);
	});
});

bot.hears(/\/info/, (ctx) => {
	console.log('/info');

	db.all('SELECT SUM(fileSize) as totalSize, COUNT(*) as totalCount FROM videos', [], (err, rows) => {
		if (err) {
			console.error(err);
			return;
		}

		const totalSize = rows[0].totalSize || 0;
		const totalCount = rows[0].totalCount || 0;

		ctx.reply(`Total files: ${totalCount}\nTotal size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
	});
});

// bot.on('message_created', (ctx) => {
//     console.log('==== ctx.botInfo:', ctx.botInfo);
//     console.log('==== ctx.user:', ctx.user);
//     console.log('==== ctx.message:', ctx.message);
// });

function manageStorage() {
	db.all('SELECT id, filePath, fileSize, downloadCount FROM videos ORDER BY downloadTime ASC', [], (err, rows) => {
		if (err) {
			console.error(err);
			return;
		}

		let currentSize = rows.reduce((acc, row) => acc + row.fileSize, 0);

		while (currentSize > maxStorageSize && rows.length > 0) {
			const fileToRemove = rows.shift();

			fs.unlink(fileToRemove.filePath, (err) => {
				if (err) {
					console.error(err);
					return;
				}

				db.run('DELETE FROM videos WHERE id = ?', [fileToRemove.id], (err) => {
					if (err) {
						console.error(err);
						return;
					}

					currentSize -= fileToRemove.fileSize;
				});
			});
		}
	});
}

bot.start();

console.log('Max Bot started', new Date(), 'with token:', process.env.MAX_BOT_TOKEN);
