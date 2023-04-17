export function DownloadIcon({hidden}) {
    return (
        hidden ? '' : <img className="mr-2 h-4 hidden" src="/download.svg"/>
    );
}