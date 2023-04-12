export function LoadingIcon({hidden}) {
    return (
        hidden ? '' : <img className="mr-2 h-4 loader" src="/loader.gif"/>
    );
}