const { fetchFile } = FFmpegUtil;
const { FFmpeg } = FFmpegWASM;
let ffmpeg = null;

document.getElementById('fileInput').addEventListener('change', analyzeLoudness, false);

let videoEle = document.getElementById('video');
let loudnessEle = document.getElementById('loudness');
let peak_dbEle = document.getElementById('peak_db');
let stateEle = document.getElementById('state');

async function analyzeLoudness(event) {

    const file = event.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    videoEle.src = url;

    // ffmpegのインスタンスがまだロードされていない場合にのみロードする
    if (ffmpeg === null) {
        ffmpeg = new FFmpeg()
        await ffmpeg.load({
            coreURL: "/MovieSoundAnalyzer/assets/core/package/dist/umd/ffmpeg-core.js",
        });
    }

    const name = file.name;

    try {
        console.log(`"${name}"を処理中...`);
        stateEle.innerText = "計測中…少し時間がかかります。"

        await ffmpeg.writeFile(name, await fetchFile(file));

        // ログを蓄積する変数
        let loudnessData = "";

        // ログをまとめて取得するためのコールバック
        ffmpeg.on('log', ({ message }) => {
            loudnessData += message + "\n";  // ログを蓄積
        });

        // ラウドネス正規化を適用してWAVとして出力
        await ffmpeg.exec([
            '-i', name,
            '-filter_complex', '[0:a]ebur128=framelog=verbose[aout];[0:a]volumedetect[out]',
            '-map', '[aout]',
            '-map', '[out]',
            '-f', 'null',
            '-'
        ]);

        // ffmpegの出力からラウドネス情報を読み取る
        console.log(`"${name}"の処理が完了しました。`);
        console.log(loudnessData);

        [integratedLoudness, peakLevel_dB] = parseLoudnessSummary(loudnessData);
        loudnessEle.innerText = integratedLoudness;
        peak_dbEle.innerText = peakLevel_dB;
        stateEle.innerText = "計測が完了しました。"

    } catch (error) {
        alert(`${name}の処理中にエラーが発生しました。`);
        console.error(error);
        stateEle.innerText = "エラーが発生しました。その動画ファイルは分析できません。"
    }
}

function parseLoudnessSummary(logData) {
    // 最終的なラウドネスデータを正規表現で抽出
    const integratedRegex = /I:\s+([-\d.]+) LUFS/g;
    const peakRegex = /max_volume:\s+([-\d.]+)/;

    const integratedMatches = [...logData.matchAll(integratedRegex)];
    const peakMatch = logData.match(peakRegex);

    const integratedLoudness = integratedMatches.length > 0 ? parseFloat(integratedMatches[integratedMatches.length - 1][1]) : null;
    const peakLevel_dB = peakMatch ? parseFloat(peakMatch[1]) : null;

    return [
        integratedLoudness,
        peakLevel_dB
    ];
}
