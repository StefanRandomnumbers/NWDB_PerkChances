import { html, render, useState, useEffect, useRef, useReducer } from '/standalone.js'
import { Component } from '/preact.module.js';


function App() {
  const [resultsReady, setResultsReady] = useState(false);
  const [url, setUrl] = useState('');
  const [perkInfos, setPerkInfos] = useState([]);
  const [removedLabels, setRemovedLabels] = useState([]);

  const dataReducer = (state, action) =>  {
    switch(action.type) {
      case 'renew':
        setRemovedLabels([]);
        return action.newState;
      case 'check':
        const { index } = action;
        // get a copy
        const newState = JSON.parse(JSON.stringify(state));
        const checkedItem = newState[index];
        if (checkedItem.checked === false) {
          newState.forEach(e => e.checked = false)
        }
        checkedItem.checked = !checkedItem.checked;
        const newRemovedLabels = checkedItem.checked ? checkedItem.labels : []
        setRemovedLabels(newRemovedLabels);
        let totalChanceRemaining = 0;
        newState.forEach(item => {
          if (!compareLabels(item.labels, newRemovedLabels)) {
            item.chance = item.original.chance;
            totalChanceRemaining += item.original.chance;
          } 
        }); 

        newState.forEach(item => {
          if (!compareLabels(item.labels, newRemovedLabels)) {
            item.chanceAfter = item.chance / totalChanceRemaining ;
          }
        });

        return newState;
    }
  }

  const [data, updateData] = useReducer(dataReducer, []);

  const getBuckets = async (url) => {
    let correctUrl = url;
    if (!url.includes('https://')) {
      correctUrl = 'https://' + correctUrl;
    }
    const r = await fetch('https://api.allorigins.win/raw?url=' + correctUrl + '.json');
    const json = await r.json();
    const bucket = json.data.perkBuckets.filter(e => e.type === 'Generated').pop();

    return bucket.perks;
  }

  const updateResults = async () => {
    // fill the tableData with only the relevant perk infos
    const r = await getBuckets(url);
  
    setPerkInfos(r);
  }

  useEffect(() => {
    if (perkInfos.length) {
      setResultsReady(true);
    }

    const d = perkInfos.map(item => {
      return {
        original: item,
        checked: false,
        perk: item.perk,
        labels: item.perk.labels,
        chance: item.chance,
        chanceAfter: item.chance
      }
    })
    
    updateData({
      type: 'renew',
      newState: d
    }) 
  }, [perkInfos])

  function compareLabels (labels, removedOverride) {
    let removedToCheck = removedOverride ? removedOverride : removedLabels;
    for (let label of labels) {
      if (removedToCheck.includes(label)) {
        return true;
      }
    }

    return false;
  }

  return html`
    <div>
      <form class="form" onSubmit=${(e) => {e.preventDefault(); updateResults()}}>
        <input id="url" placeholder="paste nwdb.info url..." type="text" value=${url} onChange=${(e) => setUrl(e.target.value)} />
        <button id="submit" type="submit">Go!</button>
      </form>
      ${ resultsReady ? 
          html`
            <table class="tb">
              <thead>
                <th></th>
                <th>Perk</th>
                <th>Label</th>
                <th>Chance</th>
                <th>New Chance</th>
              </thead>
              <tbody>
                ${
                  data.map((item, index) => {
                    return html`
                      <tr style=${{'background-color': item.checked || compareLabels(item.perk.labels) ? 'lightgray' : 'white'}}>
                        <td>
                          <input disabled=${compareLabels(item.perk.labels) && !item.checked} type="checkbox" value=${item.checked}
                            onChange=${()=> updateData({ type: 'check', index })}/>
                        </td>
                        <td>
                          <a href="${'https://nwdb.info/db/perk/' + item.perk.id}">${item.perk.name}</a>
                        </td>
                        <td>
                          ${item.perk.labels.join(', ')}
                        </td>
                        <td>${item.checked || compareLabels(item.perk.labels) ? '-' : (item.chance * 100).toFixed(2)}</td>
                        <td>${item.checked || compareLabels(item.perk.labels) ? '-' : (item.chanceAfter * 100).toFixed(2)}</td>
                      </tr> `;
                })
                }
              </tbody>
            </table>
          ` : 
          null

      }
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
