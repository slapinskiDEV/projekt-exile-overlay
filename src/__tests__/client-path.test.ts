import { describe, expect, it } from 'vitest';
import { candidateClientPaths, detectClientTxt, parseLibraryFolders } from '../main/client-path';

const VDF = `"libraryfolders"
{
	"0"
	{
		"path"		"C:\\\\Program Files (x86)\\\\Steam"
		"label"		""
		"apps"
		{
			"228980"		"0"
		}
	}
	"1"
	{
		"path"		"D:\\\\SteamLibrary"
		"apps"
		{
			"2694490"		"52000000000"
		}
	}
}`;

describe('client path detection', () => {
  it('parses Steam library folders', () => {
    expect(parseLibraryFolders(VDF)).toEqual(['C:\\Program Files (x86)\\Steam', 'D:\\SteamLibrary']);
  });

  it('builds unique candidates for Steam and standalone', () => {
    const paths = candidateClientPaths(['C:\\Program Files (x86)\\Steam', 'c:\\program files (x86)\\steam', 'D:\\SteamLibrary']);
    expect(paths).toEqual([
      'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile 2\\logs\\Client.txt',
      'D:\\SteamLibrary\\steamapps\\common\\Path of Exile 2\\logs\\Client.txt',
      'C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile 2\\logs\\Client.txt',
      'C:\\Program Files\\Grinding Gear Games\\Path of Exile 2\\logs\\Client.txt',
    ]);
  });

  it('returns only existing files', () => {
    const standalone = 'C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile 2\\logs\\Client.txt';
    expect(detectClientTxt((p) => p === standalone)).toEqual([standalone]);
  });
});
