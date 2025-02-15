// @ts-nocheck
import graphology from 'graphology'
import { bidirectional } from 'graphology-shortest-path'
import stationsFC from './assets/stations.json'
import { distance } from '@turf/turf'

export let stations = stationsFC.features
for (const station of stations) {
  station.properties.nameUp = station.properties.STOP_NAME.replace(/ Railway Station.*$/, '')
  if (station.properties.nameUp === 'Surrey Hills') {
    station.properties.nameUp = 'Union';
  } else if (station.properties.nameUp==='Glenhuntly') {
    station.properties.nameUp = 'Glen Huntly'
  }

  station.properties.lines = station.properties.ROUTEUSSP.toLowerCase().split(',')
  station.properties.name = station.properties.nameUp.toLowerCase()

}
stations = stations.filter(s => s.properties.name !== 'mont albert');
export const stationNames = stations.map(station => station.properties.name)

window.s = stations
window.sn = stationNames
function getLines() {
  const lines = new Set<string>()
  for (const station of stations) {
    for (const line of station.properties.lines) {
      lines.add(line.toLowerCase())
    }
  }
  return [...lines]
}

export function stationDistance(a,b) {
  return distance(stations.find(station => station.properties.name === a), stations.find(station => station.properties.name === b))
}
window.sd = stationDistance




// find the station whose name begins with the line, then return the rest of the stations in order
// of distance from the one before
// function stationsForLine(line: string) {
//   let start = stations.find(station => station.properties.name === line)
//   const lineStations = stations.filter(station => station.properties.ROUTEUSSP.split(',').includes(line))
//   lineStations.sort((a, b) => distance(a, start) - distance(b, start))
//   console.log(lineStations.map(station => station.properties.name).join(', '))
//   return lineStations.map(station => station.properties.name)



// }

// find the station whose name begins with the line, then return the rest of the stations in order
// of distance from the one before
function stationsForLine(line: string) {
  // console.log('stationsforline',line)
  const lineStations = stations.filter(station => station.properties.lines.includes(line))
  let current = lineStations.find(station => station.properties.name === line)
  if (!current) {
    return []
  }
  let remainingStations = lineStations.filter(station => station.properties.name !== line)
  const result = [current]
  // console.log(current.properties.name)
  while (remainingStations.length) {
    remainingStations.sort((a, b) => distance(a, current) - distance(b, current))
    current = remainingStations[0];
    result.push(current)
    // console.log(current.properties.name)
    remainingStations = remainingStations.filter(station => station !== current)
  }
  return result.map(station => station.properties.name)

}



let graph
function initGraph() {
  graph = new graphology.Graph()

  function addEdge(a,b) {
    // console.log(a,b)
    graph.addEdge(a,b)
    graph.addEdge(b,a)
  }

  window.gr=graph
  const lines = getLines();
  for (const station of stations) {
    // console.log(station.properties.name)
    graph.addNode(station.properties.name)
  }
  const cityLoop = ['Flinders Street', 'Southern Cross', 'Flagstaff','Melbourne Central','Parliament'].map(s=>s.toLowerCase())
  cityLoop.forEach((station,i) => addEdge(station, cityLoop[(i+1) % (cityLoop.length)]))

  //Add hacks for missing links where there are alternate routes not included in the main algorithm.
  try {
    addEdge('flinders street', 'richmond')
    addEdge('flinders street', 'jolimont-mcg') 
    addEdge('southern cross', 'north melbourne') 
    addEdge('laverton', 'newport')
  } catch(e){
  }

  window.n = stations.map(station => station.properties.name)
  for (const line of lines) {
    const lineStations = stationsForLine(line)

    for (let i = 0; i < lineStations.length - 1; i++) {
        try {
          if (cityLoop.includes(lineStations[i]) && cityLoop.includes(lineStations[i + 1])) {
            continue
          }
        addEdge(lineStations[i], lineStations[i + 1])
        // console.log(lineStations[i], lineStations[i + 1], line)
        } catch (e) {
        }
      }

  }

}

export function getShortestPath(from: string, to: string) {
  if (!graph) {
    initGraph()
  }

  const path  = bidirectional(graph, from, to)
  return path
}

export function stationByName(stationName) {
  return stations.find(station => station.properties.name === stationName)
}

export function hintForStation(station, target, hintsLeft) {
  const lines = stationByName(station).properties.lines;
  let targetLine =lines.find(line => stationByName(target).properties.lines.includes(line))
  if (!targetLine) {
    targetLine = lines[0]
    // return "You're on the wrong line."
  }
  const targetLineStations = stationsForLine(targetLine)
  const stationIndex = targetLineStations.indexOf(station)
  // 2 stations before, then station, then 2 stations after
  const neighbours = targetLineStations.slice(Math.max(stationIndex - 2,0), stationIndex + 3)
  const neighbourStations = neighbours.map(
    neighbourName => {
    const neighbour = stationByName(neighbourName)

    if (station === neighbour.properties.name) {
      return neighbour.properties.nameUp
    }
    if (hintsLeft == 3) {
      return neighbour.properties.nameUp.replace(/\b(\w)\w+/g, '$1').replace(/ /g, '')
    } else if (hintsLeft === 2) {
      return neighbour.properties.nameUp.split(' ').map(part => part.replace(/\b(\w\w)(\w*)/g, (match, p1, p2) => p1 + '_'.repeat(p2.length))).join(' ')
    } else if (hintsLeft === 1) {
        return neighbour.properties.nameUp.split(' ').map(part => part.replace(/\b(\w\w)(\w*)(\w)\b/g, (match, p1, p2,p3) => p1 + '_'.repeat(p2.length) + p3)).join(' ')
      }

  })
  return neighbourStations.join(', ')
}